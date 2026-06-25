import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";
import { computeStatsAtLevel } from "../systems/stats/formulas";

const COMMANDER_ATTRS = { VIT: 12, MIG: 4, AGI: 4, INT: 8, INS: 10, PRE: 18 };
const COMMANDER_STATS = computeStatsAtLevel(COMMANDER_ATTRS, 10);

const KITE_DISTANCE = 260; // stays back behind the frontline
const BOW_RANGE = 520;
const ARROW_SPEED = 460;
const HEAL_AMOUNT = 100;
const HEAL_HP_THRESHOLD = 0.5; // ally below half HP becomes a candidate
const HEAL_COOLDOWN_MS = 6000; // commander pacing between heals
const COMMANDER_HEAL_MARKER = "healed_by_commander";

// Commander: a bow user that hangs behind its allies. Its abilities are real
// skills — command_aura (passive buff field) and reinforcements (relocate +
// summon a fighter). All buff bookkeeping lives in the Enemy base.
export class CommanderEnemy extends Enemy {
  private nextBowAt = 0;
  private nextHealAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-commander",
      kind: "commander",
      aggroRadius: 560,
      bodyW: 22,
      bodyH: 32,
      bodyOffX: 2,
      bodyOffY: 2,
      knockbackResist: 0.4,
      hpBarWidth: 60,
      respawnMs: 8000,
      trackingDelayMs: 500,
      attributes: COMMANDER_ATTRS,
      mainStats: COMMANDER_STATS.main,
      subStats: COMMANDER_STATS.sub,
      heldWeaponTexture: "wpn-musket",
      heldWeaponScale: 1,
      heldWeaponOffsetX: 10,
      heldWeaponOffsetY: 2,
      heldWeaponRotation: 0,
    });
    this.addSkill(SKILLS.command_aura);
    this.addSkill(SKILLS.reinforcements);
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Passive: keep the command aura up at all times.
    if (!this.hasAura("command_aura")) this.castSkill(SKILLS.command_aura, now);

    // Active: heal a wounded ally that hasn't been healed by us yet.
    if (now >= this.nextHealAt) {
      const target = this.findHealTarget();
      if (target) {
        this.nextHealAt = now + HEAL_COOLDOWN_MS;
        this.castHealOnAlly(target);
      }
    }

    if (!player.alive) {
      body.setVelocityX(0);
      return;
    }

    // Active: reinforcements when mana allows. The skill relocates to the
    // furthest platform (creating distance) and then summons a fighter.
    if (this.canCast(SKILLS.reinforcements, now)) {
      this.castSkill(SKILLS.reinforcements, now);
      return;
    }

    // Stay back; prefer ranged. Back away if the player gets close.
    const dist = this.distanceTo(player);
    const speed = this.moveSpeedPx();
    if (dist < KITE_DISTANCE) {
      const dirAway = player.x < this.sprite.x ? 1 : -1;
      body.setVelocityX(speed * dirAway);
      this.sprite.setFlipX(player.x < this.sprite.x);
    } else {
      body.setVelocityX(0);
      this.sprite.setFlipX(player.x < this.sprite.x);
    }

    // Bow shot.
    if (dist < BOW_RANGE && now >= this.nextBowAt && this.ability) {
      this.nextBowAt = now + 3000;
      this.fireBow(player);
    }
  }

  // Commander fires a red ball from its position that arcs out and converts
  // into a chaser on landing.
  protected performSummon(opts: {
    summonType: string;
    maxActive: number;
    hp: number;
    atk: number;
  }): void {
    if (!this.ability) return;
    this.summons = this.summons.filter((s) => s.alive);
    if (this.summons.length >= opts.maxActive) return;

    const dirSign = this.facingSign();
    const sx = this.sprite.x;
    const sy = this.sprite.y - 4;
    const ex = sx + dirSign * 110;
    const ey = sy + 40;
    const ball = this.scene.add
      .circle(sx, sy, 7, 0xff3030, 1)
      .setStrokeStyle(2, 0xff8080, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(20);

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 380,
      ease: "Sine.easeIn",
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        const lx = sx + (ex - sx) * p;
        const ly = sy + (ey - sy) * p;
        const arc = -60 * p * (1 - p) * 4;
        ball.setPosition(lx, ly + arc);
      },
      onComplete: () => {
        ball.destroy();
        if (!this.ability) return;
        const e = this.ability.summon(opts.summonType, ex, ey);
        if (e) this.summons.push(e);
      },
    });
  }

  private findHealTarget(): Enemy | null {
    if (!this.ability) return null;
    let best: Enemy | null = null;
    let bestRatio = HEAL_HP_THRESHOLD;
    for (const a of this.ability.allies()) {
      if (a.markers.has(COMMANDER_HEAL_MARKER)) continue;
      const ratio = a.hp / a.maxHp;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = a;
      }
    }
    return best;
  }

  // Fires a small green dot from the commander into the sky, then straight
  // down onto the chosen ally. On impact, the ally is healed for 100 HP and
  // permanently tagged so the commander never heals them again.
  private castHealOnAlly(ally: Enemy): void {
    ally.markers.add(COMMANDER_HEAL_MARKER);
    const sx = this.sprite.x;
    const sy = this.sprite.y - 6;
    const apexX = (sx + ally.sprite.x) / 2;
    const apexY = Math.min(sy, ally.sprite.y) - 140;
    const dot = this.scene.add
      .circle(sx, sy, 4, 0x60ff80, 1)
      .setStrokeStyle(2, 0xb0ffb0, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(20);

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 280,
      ease: "Sine.easeOut",
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        dot.setPosition(sx + (apexX - sx) * p, sy + (apexY - sy) * p);
      },
      onComplete: () => {
        // Straight drop onto the ally.
        this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 220,
          ease: "Quad.easeIn",
          onUpdate: (tw) => {
            const p = tw.getValue() ?? 0;
            dot.setPosition(apexX + (ally.sprite.x - apexX) * p, apexY + (ally.sprite.y - apexY) * p);
          },
          onComplete: () => {
            dot.destroy();
            if (ally.alive) {
              ally.hp = Math.min(ally.maxHp, ally.hp + HEAL_AMOUNT);
              ally.sprite.setTint(0x60ff80);
              this.scene.time.delayedCall(120, () => {
                if (ally.alive) ally.sprite.clearTint();
              });
            }
          },
        });
      },
    });
  }

  private fireBow(player: PlayerView): void {
    const dirSign = player.x < this.sprite.x ? -1 : 1;
    const ox = this.sprite.x + dirSign * 10;
    const oy = this.sprite.y - 4;
    let dx = player.x - ox;
    let dy = player.y - oy - 24;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    this.ability!.spawnProjectile({
      x: ox,
      y: oy,
      vx: dx * ARROW_SPEED,
      vy: dy * ARROW_SPEED,
      damage: 15,
      texture: "proj-musket-ball",
      range: 640,
      rotation: Math.atan2(dy, dx),
      knockX: 80,
      knockY: -40,
      homingTurnRate: 0,
      gravityAfterMs: 260,
      piercing: false,
      glowTint: 0,
      glowFrequencyMs: 0,
      glowLifespanMs: 0,
    });
  }
}
