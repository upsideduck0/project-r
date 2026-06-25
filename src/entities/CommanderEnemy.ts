import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";

const KITE_DISTANCE = 260; // stays back behind the frontline
const BOW_RANGE = 520;
const ARROW_SPEED = 460;

// Commander: a bow user that hangs behind its allies. Its abilities are real
// skills — command_aura (passive buff field) and reinforcements (relocate +
// summon a fighter). All buff bookkeeping lives in the Enemy base.
export class CommanderEnemy extends Enemy {
  private nextBowAt = 0;

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
      attributes: { VIT: 10, MIG: 6, AGI: 6, INT: 8, INS: 8, PRE: 18 },
      mainStats: {
        HP: 200, MP: 100, STA: 18, ATK: 12, DEF: 30, MS: 3, AS: 2.4, TEN: 10,
      },
      subStats: { GEN: 10 },
    });
    this.addSkill(SKILLS.command_aura);
    this.addSkill(SKILLS.reinforcements);
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Passive: keep the command aura up at all times.
    if (!this.hasAura("command_aura")) this.castSkill(SKILLS.command_aura, now);

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
      damage: this.atk,
      texture: "proj-arrow",
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
