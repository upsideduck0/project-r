import Phaser from "phaser";
import { StatBlock } from "../systems/stats/StatBlock";
import { AttributeSet, MainStatSet, SubStatSet } from "../systems/stats/types";
import { applyRegen } from "../systems/regen";
import { ProjectileSpawnConfig } from "../systems/Projectiles";
import {
  AuraSkillData,
  DashDirection,
  executeSkill,
  SkillCaster,
  SkillDef,
  SkillStatMod,
} from "../data/skills";

export type EnemyState = "idle" | "aggro" | "attack" | "hurt" | "dead";

export interface EnemyConfig {
  textureKey: string;
  kind?: string;
  aggroRadius: number;
  bodyW: number;
  bodyH: number;
  bodyOffX: number;
  bodyOffY: number;
  knockbackResist?: number;
  hpBarWidth?: number;
  respawnMs?: number;
  // Throttles AI re-evaluation. Decisions and direction caching only fire once
  // every N ms; per-frame work (velocity application, jump, hp bar) still runs
  // every frame. 0 = re-evaluate every frame.
  trackingDelayMs?: number;
  // Character stat framework. Enemies use authored main/sub stats (their
  // hand-tuned sheets are exact); gameplay reads HP/ATK/MS/AS/GEN from here.
  attributes?: Partial<AttributeSet>;
  mainStats?: Partial<MainStatSet>;
  subStats?: Partial<SubStatSet>;
}

export interface PlayerView {
  x: number;
  y: number;
  facing: 1 | -1;
  alive: boolean;
}

// Capabilities the scene grants each enemy so its skills can reach into the
// world. Injected after construction; without it an enemy simply can't cast.
export interface EnemyAbilityContext {
  target(): PlayerView;
  allies(): Enemy[]; // living enemies excluding self
  platformTops(): { x: number; y: number }[];
  worldMinX: number;
  worldMaxX: number;
  spawnProjectile(cfg: ProjectileSpawnConfig): void;
  summon(kind: string, x: number, y: number): Enemy | null;
}

const KNOCKBACK_MS = 200;
// Stat-unit -> pixel conversions (centralized so tuning is one place).
const MS_TO_PX = 35; // movement: pixels/sec per MS point
const ATTACK_INTERVAL_BASE = 2550; // attack interval ms = BASE / AS
const JUMP_BASE = 200; // upward velocity floor
const JUMP_PER_AGI = 16; // + per AGI point (jump height scales with AGI)

interface AuraInstance {
  data: AuraSkillData;
  skillId: string;
  color: number;
  expiresAt: number;
  nextTickAt: number;
  ring: Phaser.GameObjects.Arc;
  affected: Set<Enemy>;
}

let enemyIdCounter = 0;

export abstract class Enemy {
  readonly id: string;
  scene: Phaser.Scene;
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  mp: number;
  sta: number;
  maxHp: number;
  maxMp: number;
  maxSta: number;
  aggroRadius: number;
  kind: string;
  trackingDelayMs: number;
  stats: StatBlock;
  state: EnemyState = "idle";
  knockbackEndAt = 0;
  lastHurtAt = -Infinity;
  lastAttackAt = -Infinity;
  spawnX: number;
  spawnY: number;
  alive = true;
  private nextTrackAt = -Infinity;

  skills: SkillDef[] = [];
  ability?: EnemyAbilityContext;

  private knockbackResist: number;
  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private hpBarWidth: number;
  private hpBarOffsetY: number;
  private respawnMs: number;

  // Buff bookkeeping: sourceId -> StatBlock modifier ids it owns.
  private buffSources = new Map<string, string[]>();
  private buffGlow: Phaser.GameObjects.Ellipse;
  private buffGlowTween?: Phaser.Tweens.Tween;

  private auras: AuraInstance[] = [];
  private summons: Enemy[] = [];
  private skillCdUntil = new Map<string, number>();
  private nextAttackBonus = 0;
  private nextAttackBonusUntil = 0;
  private caster?: SkillCaster;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: EnemyConfig) {
    this.id = `enemy-${++enemyIdCounter}`;
    this.scene = scene;
    this.spawnX = x;
    this.spawnY = y;
    this.aggroRadius = cfg.aggroRadius;
    this.kind = cfg.kind ?? "enemy";
    this.trackingDelayMs = cfg.trackingDelayMs ?? 0;
    this.knockbackResist = cfg.knockbackResist ?? 0;
    this.hpBarWidth = cfg.hpBarWidth ?? 32;
    this.respawnMs = cfg.respawnMs ?? 3500;
    this.stats = new StatBlock({
      attributes: cfg.attributes,
      baseMainStats: cfg.mainStats,
      baseSubStats: cfg.subStats,
      mainStatMode: "authored",
      subStatMode: "authored",
    });

    this.maxHp = Math.round(this.stats.getMain("HP")) || 1;
    this.maxMp = Math.round(this.stats.getMain("MP"));
    this.maxSta = Math.round(this.stats.getMain("STA"));
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.sta = this.maxSta;

    this.sprite = scene.physics.add.sprite(x, y, cfg.textureKey);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10); // explicit: characters render above environment.
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(cfg.bodyW, cfg.bodyH).setOffset(cfg.bodyOffX, cfg.bodyOffY);
    body.setDragX(2000);
    body.setMaxVelocity(600, 1200);
    this.sprite.setData("enemy", this);

    this.hpBarOffsetY = -(cfg.bodyH / 2 + 10);
    this.hpBg = scene.add
      .rectangle(x, y + this.hpBarOffsetY, this.hpBarWidth + 2, 4, 0x000000, 0.75)
      .setDepth(900);
    this.hpFill = scene.add
      .rectangle(
        x - this.hpBarWidth / 2,
        y + this.hpBarOffsetY,
        this.hpBarWidth,
        2,
        0xe06070,
        1,
      )
      .setOrigin(0, 0.5)
      .setDepth(901);
    // White halo behind the sprite, visible while any buff is active.
    // Depth 5 puts it above environment (-50) and below characters (10) so it
    // reads as a glow extending past the sprite outline.
    this.buffGlow = scene.add
      .ellipse(x, y, cfg.bodyW + 32, cfg.bodyH + 34, 0xffffff, 0.85)
      .setStrokeStyle(2, 0xffffff, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(5)
      .setVisible(false);
  }

  // ----- Stat-derived gameplay values -----

  get atk(): number {
    return Math.round(this.stats.getMain("ATK"));
  }

  moveSpeedPx(): number {
    return this.stats.getMain("MS") * MS_TO_PX;
  }

  attackIntervalMs(): number {
    const as = Math.max(0.1, this.stats.getMain("AS"));
    return Phaser.Math.Clamp(ATTACK_INTERVAL_BASE / as, 120, 6000);
  }

  // True at most once every trackingDelayMs. Subclasses gate AI re-evaluation
  // (direction choice, cast attempts, etc.) behind this so behaviour has a
  // predictable reaction latency. Per-frame work (velocity application, jump,
  // hp bar) still runs every frame.
  protected shouldTrack(now: number): boolean {
    if (now < this.nextTrackAt) return false;
    this.nextTrackAt = now + this.trackingDelayMs;
    return true;
  }

  // ----- Ability wiring -----

  setAbilityContext(ctx: EnemyAbilityContext): void {
    this.ability = ctx;
  }

  addSkill(skill: SkillDef): void {
    this.skills.push(skill);
  }

  canCast(skill: SkillDef, now: number): boolean {
    if (!this.ability || !this.alive) return false;
    if (now < (this.skillCdUntil.get(skill.core.id) ?? 0)) return false;
    if (this.mp < skill.core.manaCost) return false;
    return true;
  }

  castSkill(skill: SkillDef, now: number): boolean {
    if (!this.canCast(skill, now)) return false;
    this.mp -= skill.core.manaCost;
    this.skillCdUntil.set(skill.core.id, now + skill.core.cooldownMs);
    const run = () => {
      if (!this.alive) return;
      executeSkill(skill, this.getCaster(), {
        damage: {
          attributes: this.stats.getAttributes(),
          atk: this.atk,
          amp: this.stats.getSub("AMP"),
        },
      });
    };
    if (skill.core.castTimeMs > 0) {
      // Telegraph: brief tint during the wind-up, then fire.
      this.sprite.setTint(0xffffff);
      this.scene.time.delayedCall(skill.core.castTimeMs, () => {
        if (this.alive) this.sprite.clearTint();
        run();
      });
    } else {
      run();
    }
    return true;
  }

  hasAura(skillId: string): boolean {
    return this.auras.some((a) => a.skillId === skillId);
  }

  private getCaster(): SkillCaster {
    if (!this.caster) this.caster = this.buildCaster();
    return this.caster;
  }

  private facingSign(): 1 | -1 {
    return this.sprite.flipX ? -1 : 1;
  }

  private buildCaster(): SkillCaster {
    return {
      self: () => ({
        x: this.sprite.x,
        y: this.sprite.y,
        facing: this.facingSign(),
      }),
      aimPoint: () => {
        const t = this.ability?.target();
        return t ? { x: t.x, y: t.y } : { x: this.sprite.x, y: this.sprite.y };
      },
      heal: (a) => {
        this.hp = Math.min(this.maxHp, this.hp + a);
      },
      restoreMana: (a) => {
        this.mp = Math.min(this.maxMp, this.mp + a);
      },
      restoreStamina: (a) => {
        this.sta = Math.min(this.maxSta, this.sta + a);
      },
      spawnProjectile: (cfg) => this.ability?.spawnProjectile(cfg),
      dash: (distance, direction) => this.performDash(distance, direction),
      applyInvuln: () => {
        /* enemies have no invuln window yet */
      },
      flash: (color, ms) => {
        this.sprite.setTint(color);
        this.scene.time.delayedCall(ms, () => {
          if (this.alive) this.sprite.clearTint();
        });
      },
      castVisual: (color, radius) => this.spawnCastVisual(color, radius),
      startAura: (aura, skillId, color) => this.startAura(aura, skillId, color),
      spawnSummon: (opts) => this.performSummon(opts),
      applyTimedSelfBuff: (mods, ms) =>
        this.applyStatBuff(`selfbuff-${this.id}`, mods, ms),
      grantNextAttackBonus: (amount, ms) => {
        this.nextAttackBonus = amount;
        this.nextAttackBonusUntil = this.scene.time.now + ms;
      },
    };
  }

  // ----- Movement helpers -----

  // Jump height scales with AGI. Only fires when grounded.
  tryJump(): boolean {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down && !body.touching.down) return false;
    const agi = this.stats.getAttributes().AGI;
    body.setVelocityY(-(JUMP_BASE + agi * JUMP_PER_AGI));
    return true;
  }

  private performDash(distance: number, direction: DashDirection): void {
    const ab = this.ability;
    const sx = this.sprite.x;
    let tx = sx;
    let ty = this.sprite.y;
    const t = ab?.target();
    switch (direction) {
      case "toward_target":
        if (t) tx = sx + Math.sign(t.x - sx || 1) * distance;
        break;
      case "away_from_target":
        if (t) tx = sx - Math.sign(t.x - sx || 1) * distance;
        break;
      case "to_nearest_ally": {
        const ally = this.nearestAlly();
        if (ally) tx = ally.sprite.x + (sx < ally.sprite.x ? -28 : 28);
        break;
      }
      case "to_furthest_platform": {
        const p = this.furthestPlatformFromTarget();
        if (p) {
          tx = p.x;
          ty = p.y;
        }
        break;
      }
      case "facing":
      default:
        tx = sx + this.facingSign() * distance;
        break;
    }
    if (ab) tx = Phaser.Math.Clamp(tx, ab.worldMinX, ab.worldMaxX);
    this.spawnDashTrail();
    this.sprite.setPosition(tx, ty);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  private nearestAlly(): Enemy | null {
    if (!this.ability) return null;
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const a of this.ability.allies()) {
      const d = Math.abs(a.sprite.x - this.sprite.x);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  private furthestPlatformFromTarget(): { x: number; y: number } | null {
    if (!this.ability) return null;
    const t = this.ability.target();
    let best: { x: number; y: number } | null = null;
    let bestD = -Infinity;
    for (const p of this.ability.platformTops()) {
      const d = Math.abs(p.x - t.x);
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private performSummon(opts: {
    summonType: string;
    maxActive: number;
    hp: number;
    atk: number;
  }): void {
    if (!this.ability) return;
    this.summons = this.summons.filter((s) => s.alive);
    if (this.summons.length >= opts.maxActive) return;
    const offset = this.facingSign() * 40;
    const s = this.ability.summon(
      opts.summonType,
      this.sprite.x + offset,
      this.sprite.y,
    );
    if (s) this.summons.push(s);
  }

  private spawnCastVisual(color: number, radius: number): void {
    const ring = this.scene.add
      .circle(this.sprite.x, this.sprite.y, Math.max(14, radius * 0.4), color, 0.35)
      .setStrokeStyle(3, color, 0.9)
      .setDepth(this.sprite.depth + 2);
    this.scene.tweens.add({
      targets: ring,
      radius: Math.max(20, radius),
      alpha: 0,
      duration: 320,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  // ----- Buff modifiers (via the stat framework) -----

  applyStatBuff(sourceId: string, mods: SkillStatMod[], durationMs?: number): void {
    this.removeStatBuff(sourceId); // refresh
    const ids: string[] = [];
    mods.forEach((m, i) => {
      const modId = `${sourceId}#${i}`;
      this.stats.addModifier({
        id: modId,
        source: "buff",
        stat: m.stat,
        op: m.op,
        value: m.value,
      });
      ids.push(modId);
    });
    this.buffSources.set(sourceId, ids);
    this.refreshMaxFromStats();
    if (this.alive) this.showBuffGlow();
    if (durationMs && durationMs > 0) {
      this.scene.time.delayedCall(durationMs, () => this.removeStatBuff(sourceId));
    }
  }

  removeStatBuff(sourceId: string): void {
    const ids = this.buffSources.get(sourceId);
    if (!ids) return;
    for (const id of ids) this.stats.removeModifier(id);
    this.buffSources.delete(sourceId);
    this.refreshMaxFromStats();
    if (this.buffSources.size === 0) this.hideBuffGlow();
  }

  private refreshMaxFromStats(): void {
    this.maxMp = Math.max(this.maxMp, Math.round(this.stats.getMain("MP")));
    this.maxSta = Math.max(this.maxSta, Math.round(this.stats.getMain("STA")));
  }

  private showBuffGlow(): void {
    if (this.buffGlow.visible) return;
    this.buffGlow.setVisible(true);
    this.buffGlowTween = this.scene.tweens.add({
      targets: this.buffGlow,
      alpha: { from: 0.5, to: 0.9 },
      scale: { from: 0.95, to: 1.12 },
      duration: 520,
      yoyo: true,
      repeat: -1,
    });
  }

  private hideBuffGlow(): void {
    if (!this.buffGlow.visible) return;
    this.buffGlow.setVisible(false);
    this.buffGlow.setScale(1);
    if (this.buffGlowTween) {
      this.buffGlowTween.remove();
      this.buffGlowTween = undefined;
    }
  }

  // ----- Auras (hosted by the casting enemy) -----

  private startAura(data: AuraSkillData, skillId: string, color: number): void {
    if (this.hasAura(skillId)) return;
    // Global auras don't show a radius ring — they cover the whole field.
    const ring = data.global
      ? this.scene.add.circle(this.sprite.x, this.sprite.y, 1, color, 0).setVisible(false)
      : this.scene.add
          .circle(this.sprite.x, this.sprite.y, data.radius, color, 0.05)
          .setStrokeStyle(2, color, 0.4)
          .setDepth(40);
    this.auras.push({
      data,
      skillId,
      color,
      expiresAt:
        data.durationMs <= 0 ? Infinity : this.scene.time.now + data.durationMs,
      nextTickAt: 0,
      ring,
      affected: new Set(),
    });
  }

  private tickAuras(now: number): void {
    for (let i = this.auras.length - 1; i >= 0; i--) {
      const aura = this.auras[i];
      aura.ring.setPosition(this.sprite.x, this.sprite.y);
      if (now >= aura.expiresAt) {
        this.endAura(aura);
        this.auras.splice(i, 1);
        continue;
      }
      if (now < aura.nextTickAt) continue;
      aura.nextTickAt = now + Math.max(50, aura.data.tickRateMs);
      this.applyAura(aura);
    }
  }

  private applyAura(aura: AuraInstance): void {
    const effects = aura.data.kindEffects;
    if (!effects || !this.ability) return;
    const r2 = aura.data.radius * aura.data.radius;
    const inRange = new Set<Enemy>();
    for (const ally of this.ability.allies()) {
      if (!aura.data.global) {
        const dx = ally.sprite.x - this.sprite.x;
        const dy = ally.sprite.y - this.sprite.y;
        if (dx * dx + dy * dy > r2) continue;
      }
      const mods = effects[ally.kind] ?? effects["*"];
      if (!mods) continue;
      inRange.add(ally);
      if (!aura.affected.has(ally)) {
        ally.applyStatBuff(`${aura.skillId}:${this.id}`, mods);
        aura.affected.add(ally);
      }
    }
    for (const ally of aura.affected) {
      if (!inRange.has(ally)) {
        ally.removeStatBuff(`${aura.skillId}:${this.id}`);
        aura.affected.delete(ally);
      }
    }
  }

  private endAura(aura: AuraInstance): void {
    for (const ally of aura.affected) {
      ally.removeStatBuff(`${aura.skillId}:${this.id}`);
    }
    aura.affected.clear();
    aura.ring.destroy();
  }

  private clearAllAuras(): void {
    for (const aura of this.auras) this.endAura(aura);
    this.auras = [];
  }

  // ----- Combat -----

  takeDamage(amount: number, knockX: number, knockY: number): void {
    if (!this.alive) return;
    // Raw damage (no DEF mitigation yet — keeping the existing combat formula
    // unchanged per directive; DEF is stored/buffable and inspectable).
    this.hp = Math.max(0, this.hp - amount);
    this.lastHurtAt = this.scene.time.now;
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (this.alive) this.sprite.clearTint();
    });
    if (knockX !== 0 || knockY !== 0) {
      const mult = 1 - this.knockbackResist;
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(knockX * mult, knockY * mult);
      this.knockbackEndAt = this.scene.time.now + KNOCKBACK_MS;
      this.state = "hurt";
    }
    if (this.hp <= 0) this.die();
  }

  tryAttackPlayer(now: number): number | null {
    if (now - this.lastAttackAt < this.attackIntervalMs()) return null;
    this.lastAttackAt = now;
    // Bodily contact damage = 1×VIT before any downstream calc (e.g. DEF).
    // Projectile / skill damage is a separate path and uses skill values.
    let dmg = Math.max(1, Math.round(this.stats.getAttributes().VIT));
    if (now < this.nextAttackBonusUntil) {
      dmg += this.nextAttackBonus;
      this.nextAttackBonus = 0;
      this.nextAttackBonusUntil = 0;
    }
    return dmg;
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.state = "dead";
    this.sprite.setActive(false).setVisible(false);
    (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.hideBuffGlow();
    this.clearAllAuras(); // buffs this enemy granted vanish immediately
    this.onDeath();
  }

  respawn(): void {
    this.sprite.setPosition(this.spawnX, this.spawnY);
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.sta = this.maxSta;
    this.alive = true;
    this.state = "idle";
    this.sprite.setActive(true).setVisible(true);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);
    if (this.buffSources.size > 0) this.showBuffGlow();
  }

  protected onDeath(): void {}

  distanceTo(p: PlayerView): number {
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.x, p.y);
  }

  private spawnDashTrail(): void {
    const ghost = this.scene.add
      .rectangle(this.sprite.x, this.sprite.y, 16, 24, 0xffffff, 0.4)
      .setDepth(this.sprite.depth - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 200,
      onComplete: () => ghost.destroy(),
    });
  }

  update(now: number, dt: number, player: PlayerView): void {
    if (!this.alive) return;

    this.hpBg.setPosition(this.sprite.x, this.sprite.y + this.hpBarOffsetY);
    this.hpFill.setPosition(
      this.sprite.x - this.hpBarWidth / 2,
      this.sprite.y + this.hpBarOffsetY,
    );
    this.hpFill.width = this.hpBarWidth * (this.hp / this.maxHp);
    this.buffGlow.setPosition(this.sprite.x, this.sprite.y);

    // Centralized GEN-driven resource regen, shared by all creatures.
    const vitals = { hp: this.hp, mp: this.mp, sta: this.sta };
    applyRegen(
      vitals,
      { hp: this.maxHp, mp: this.maxMp, sta: this.maxSta },
      this.stats.getSub("GEN"),
      dt,
    );
    this.hp = vitals.hp;
    this.mp = vitals.mp;
    this.sta = vitals.sta;

    this.tickAuras(now);

    if (this.state === "hurt" && now >= this.knockbackEndAt) {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(0);
      this.state = "idle";
    }

    this.tick(now, dt, player);
  }

  protected tick(_now: number, _dt: number, _player: PlayerView): void {}
}
