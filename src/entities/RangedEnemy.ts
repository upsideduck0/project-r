import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";

const ATTACK_RANGE = 360;
const HOP_TRIGGER = 180; // hop to a further platform when player is this close
const HOP_COOLDOWN_MS = 1500;

// The "caster": stays on a platform lobbing orb volleys (the mana_release
// skill) and leaps to a further platform when the player closes in.
export class RangedEnemy extends Enemy {
  private nextHopAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-ranged",
      kind: "caster",
      aggroRadius: 440,
      bodyW: 18,
      bodyH: 26,
      bodyOffX: 2,
      bodyOffY: 2,
      respawnMs: 4500,
      attributes: { VIT: 4, MIG: 4, AGI: 6, INT: 14, INS: 10, PRE: 4 },
      mainStats: {
        HP: 48, MP: 144, STA: 18, ATK: 8, DEF: 6, MS: 3, AS: 2.4, TEN: 4,
      },
      subStats: { GEN: 10 },
    });
    this.addSkill(SKILLS.mana_release);
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!player.alive) {
      body.setVelocityX(0);
      return;
    }

    const dist = this.distanceTo(player);
    const grounded = body.blocked.down || body.touching.down;
    this.sprite.setFlipX(player.x < this.sprite.x);

    // Player too close: hop to the platform furthest from them.
    if (dist < HOP_TRIGGER && grounded && now >= this.nextHopAt) {
      this.nextHopAt = now + HOP_COOLDOWN_MS;
      this.hopToFurtherPlatform(player);
      return;
    }

    if (grounded) body.setVelocityX(0);

    if (dist < ATTACK_RANGE) {
      this.state = "aggro";
      this.castSkill(SKILLS.mana_release, now);
    } else {
      this.state = "idle";
    }
  }

  private hopToFurtherPlatform(player: PlayerView): void {
    const plats = this.ability?.platformTops() ?? [];
    let best: { x: number; y: number } | null = null;
    let bestD = -1;
    for (const p of plats) {
      if (Math.abs(p.x - this.sprite.x) < 8) continue; // skip current platform
      const d = Math.abs(p.x - player.x);
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const dir = best.x < this.sprite.x ? -1 : 1;
    body.setVelocityX(dir * 250);
    body.setVelocityY(-500);
    this.state = "aggro";
  }
}
