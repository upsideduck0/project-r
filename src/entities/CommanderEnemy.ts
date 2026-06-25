import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";
import { computeStatsAtLevel } from "../systems/stats/formulas";

const COMMANDER_ATTRS = { VIT: 12, MIG: 4, AGI: 4, INT: 8, INS: 10, PRE: 18 };
const COMMANDER_STATS = computeStatsAtLevel(COMMANDER_ATTRS, 1);

const KITE_DISTANCE = 260; // stays back behind the frontline
const BOW_RANGE = 520;
const ARROW_SPEED = 460;
const HEAL_COOLDOWN_MS = 10000; // commander pacing between heals
const HEAL_FRACTION = 0.5; // heals 50% of the target's max HP
const BUFF_DEF_AMOUNT = 100; // flat DEF buff granted to every ally
const BUFF_BROADCAST_DELAY_MS = 600;
const BUFF_BROADCAST_STAGGER_MS = 180;

// Commander: a musket user that hangs behind its allies. On engagement it
// broadcasts a flat DEF buff to every ally (and itself) via a green-dot drop
// animation, periodically heals the lowest-HP ally, and can call in
// reinforcements.
export class CommanderEnemy extends Enemy {
  private nextBowAt = 0;
  private nextHealAt = 0;
  private buffBroadcastAt: number | null = null;
  private buffsBroadcast = false;

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
    this.addSkill(SKILLS.reinforcements);
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // One-time DEF buff broadcast. Schedules on first tick, fires after a
    // short delay, and never repeats while the commander is alive.
    if (!this.buffsBroadcast) {
      if (this.buffBroadcastAt === null) {
        this.buffBroadcastAt = now + BUFF_BROADCAST_DELAY_MS;
      } else if (now >= this.buffBroadcastAt) {
        this.broadcastBuff();
        this.buffsBroadcast = true;
      }
    }

    // Active: heal whichever ally (or self) currently has the lowest HP%.
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

  // Lowest-HP-ratio target, including self. Skips anyone already at full HP
  // so heals aren't wasted.
  private findHealTarget(): Enemy | null {
    const pool: Enemy[] = this.ability ? this.ability.allies().slice() : [];
    let best: Enemy | null = null;
    let bestRatio = 1;
    for (const e of pool) {
      if (!e.alive) continue;
      const ratio = e.hp / e.maxHp;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = e;
      }
    }
    return best;
  }

  // Heals the target for 50% of its max HP via the green-dot drop animation.
  private castHealOnAlly(ally: Enemy): void {
    this.dropOrbOnAlly(ally, 0x60ff80, 0xb0ffb0, (target) => {
      if (!target.alive) return;
      const amount = Math.round(target.maxHp * HEAL_FRACTION);
      target.hp = Math.min(target.maxHp, target.hp + amount);
      target.sprite.setTint(0x60ff80);
      this.scene.time.delayedCall(120, () => {
        if (target.alive) target.sprite.clearTint();
      });
    });
  }

  // Drops a gold orb onto every living ally (and self) with a small stagger.
  // Each impact applies a flat +DEF buff to that specific target.
  private broadcastBuff(): void {
    const targets: Enemy[] = this.ability ? this.ability.allies().slice() : [];
    targets.forEach((ally, i) => {
      this.scene.time.delayedCall(i * BUFF_BROADCAST_STAGGER_MS, () => {
        if (!this.alive || !ally.alive) return;
        this.dropOrbOnAlly(ally, 0xffd060, 0xfff0a0, (target) => {
          if (!target.alive) return;
          target.applyStatBuff(`commander_buff:${this.id}`, [
            { stat: "DEF", op: "flat", value: BUFF_DEF_AMOUNT },
          ]);
        });
      });
    });
  }

  // Shared "arc up, drop down" orb animation used by both heal and buff.
  private dropOrbOnAlly(
    ally: Enemy,
    fillColor: number,
    edgeColor: number,
    onImpact: (target: Enemy) => void,
  ): void {
    const sx = this.sprite.x;
    const sy = this.sprite.y - 6;
    const apexX = (sx + ally.sprite.x) / 2;
    const apexY = Math.min(sy, ally.sprite.y) - 140;
    const dot = this.scene.add
      .circle(sx, sy, 4, fillColor, 1)
      .setStrokeStyle(2, edgeColor, 0.95)
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
        this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 220,
          ease: "Quad.easeIn",
          onUpdate: (tw) => {
            const p = tw.getValue() ?? 0;
            dot.setPosition(
              apexX + (ally.sprite.x - apexX) * p,
              apexY + (ally.sprite.y - apexY) * p,
            );
          },
          onComplete: () => {
            dot.destroy();
            onImpact(ally);
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
