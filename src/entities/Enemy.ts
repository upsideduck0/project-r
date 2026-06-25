import Phaser from "phaser";
import { StatBlock } from "../systems/stats/StatBlock";
import { AttributeSet, MainStatSet, SubStatSet } from "../systems/stats/types";

export type EnemyState = "idle" | "aggro" | "attack" | "hurt" | "dead";

export interface BuffMods {
  // Fraction (0..1) of incoming damage absorbed. Multiple sources don't stack;
  // the strongest reduction wins.
  damageReduction?: number;
  // Multiplier on movement speed.
  moveSpeedMult?: number;
  // Multiplier on attack rate (higher = attacks more often).
  attackSpeedMult?: number;
}

export interface EnemyConfig {
  textureKey: string;
  kind?: string;
  maxHp: number;
  aggroRadius: number;
  contactDamage: number;
  bodyW: number;
  bodyH: number;
  bodyOffX: number;
  bodyOffY: number;
  knockbackResist?: number;
  hpBarWidth?: number;
  respawnMs?: number;
  attackCooldownMs?: number;
  // Character stat framework. Provided for inspection / future systems; the
  // values above (maxHp, contactDamage, ...) still drive current gameplay so
  // behaviour is unchanged.
  attributes?: Partial<AttributeSet>;
  baseMainStats?: Partial<MainStatSet>;
  baseSubStats?: Partial<SubStatSet>;
}

export interface PlayerView {
  x: number;
  y: number;
  facing: 1 | -1;
  alive: boolean;
}

const KNOCKBACK_MS = 200;

export abstract class Enemy {
  scene: Phaser.Scene;
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  maxHp: number;
  aggroRadius: number;
  contactDamage: number;
  attackCooldownMs: number;
  kind: string;
  stats: StatBlock;
  state: EnemyState = "idle";
  knockbackEndAt = 0;
  lastHurtAt = -Infinity;
  lastAttackAt = -Infinity;
  spawnX: number;
  spawnY: number;
  alive = true;
  private knockbackResist: number;
  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private hpBarWidth: number;
  private hpBarOffsetY: number;
  private respawnMs: number;
  private buffs = new Map<string, BuffMods>();
  private buffDot: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: EnemyConfig) {
    this.scene = scene;
    this.spawnX = x;
    this.spawnY = y;
    this.maxHp = cfg.maxHp;
    this.hp = cfg.maxHp;
    this.aggroRadius = cfg.aggroRadius;
    this.contactDamage = cfg.contactDamage;
    this.attackCooldownMs = cfg.attackCooldownMs ?? 800;
    this.kind = cfg.kind ?? "enemy";
    this.knockbackResist = cfg.knockbackResist ?? 0;
    this.hpBarWidth = cfg.hpBarWidth ?? 32;
    this.respawnMs = cfg.respawnMs ?? 3500;
    this.stats = new StatBlock({
      attributes: cfg.attributes,
      baseMainStats: cfg.baseMainStats,
      baseSubStats: cfg.baseSubStats,
    });

    this.sprite = scene.physics.add.sprite(x, y, cfg.textureKey);
    this.sprite.setCollideWorldBounds(true);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(cfg.bodyW, cfg.bodyH).setOffset(cfg.bodyOffX, cfg.bodyOffY);
    body.setDragX(2000);
    body.setMaxVelocity(360, 900);
    this.sprite.setData("enemy", this);

    this.hpBarOffsetY = -(cfg.bodyH / 2 + 10);
    this.hpBg = scene.add
      .rectangle(
        x,
        y + this.hpBarOffsetY,
        this.hpBarWidth + 2,
        4,
        0x000000,
        0.75,
      )
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
    this.buffDot = scene.add
      .circle(x, y + this.hpBarOffsetY - 6, 3, 0xffd060, 0.95)
      .setDepth(902)
      .setVisible(false);
  }

  applyBuff(sourceId: string, mods: BuffMods): void {
    this.buffs.set(sourceId, mods);
    this.buffDot.setVisible(this.alive);
  }

  removeBuff(sourceId: string): void {
    if (!this.buffs.delete(sourceId)) return;
    if (this.buffs.size === 0) this.buffDot.setVisible(false);
  }

  hasBuff(sourceId: string): boolean {
    return this.buffs.has(sourceId);
  }

  getDamageReduction(): number {
    let r = 0;
    for (const m of this.buffs.values()) {
      if (m.damageReduction && m.damageReduction > r) r = m.damageReduction;
    }
    return r;
  }

  getMoveSpeedMult(): number {
    let m = 1;
    for (const b of this.buffs.values()) if (b.moveSpeedMult) m *= b.moveSpeedMult;
    return m;
  }

  getAttackSpeedMult(): number {
    let m = 1;
    for (const b of this.buffs.values()) if (b.attackSpeedMult) m *= b.attackSpeedMult;
    return m;
  }

  takeDamage(amount: number, knockX: number, knockY: number): void {
    if (!this.alive) return;
    const reduction = this.getDamageReduction();
    const reduced = Math.max(1, Math.round(amount * (1 - reduction)));
    this.hp = Math.max(0, this.hp - reduced);
    this.lastHurtAt = this.scene.time.now;
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(70, () => this.sprite.clearTint());
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
    const effectiveCd = this.attackCooldownMs / this.getAttackSpeedMult();
    if (now - this.lastAttackAt < effectiveCd) return null;
    this.lastAttackAt = now;
    return this.contactDamage;
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.state = "dead";
    this.sprite.setActive(false).setVisible(false);
    (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.buffDot.setVisible(false);
    this.onDeath();
  }

  respawn(): void {
    this.sprite.setPosition(this.spawnX, this.spawnY);
    this.hp = this.maxHp;
    this.alive = true;
    this.state = "idle";
    this.sprite.setActive(true).setVisible(true);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);
    this.buffDot.setVisible(this.buffs.size > 0);
  }

  protected onDeath(): void {
    this.scene.time.delayedCall(this.respawnMs, () => this.respawn());
  }

  distanceTo(p: PlayerView): number {
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.x, p.y);
  }

  update(now: number, dt: number, player: PlayerView): void {
    if (!this.alive) return;

    this.hpBg.setPosition(this.sprite.x, this.sprite.y + this.hpBarOffsetY);
    this.hpFill.setPosition(
      this.sprite.x - this.hpBarWidth / 2,
      this.sprite.y + this.hpBarOffsetY,
    );
    this.hpFill.width = this.hpBarWidth * (this.hp / this.maxHp);
    this.buffDot.setPosition(this.sprite.x, this.sprite.y + this.hpBarOffsetY - 6);

    if (this.state === "hurt" && now >= this.knockbackEndAt) {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(0);
      this.state = "idle";
    }

    this.tick(now, dt, player);
  }

  protected tick(_now: number, _dt: number, _player: PlayerView): void {}
}
