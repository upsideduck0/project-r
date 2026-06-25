import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";

const PANIC_RANGE = 90; // teleport away when the player gets this close
const HARASS_RANGE = 150;

export class ThiefEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-thief",
      kind: "thief",
      aggroRadius: 360,
      bodyW: 14,
      bodyH: 24,
      bodyOffX: 1,
      bodyOffY: 2,
      hpBarWidth: 28,
      respawnMs: 3500,
      attributes: { VIT: 4, MIG: 6, AGI: 18, INT: 0, INS: 0, PRE: 0 },
      mainStats: {
        HP: 50, MP: 20, STA: 54, ATK: 12, DEF: 6, MS: 9, AS: 7.2, TEN: 0,
      },
      subStats: { GEN: 5 },
    });
    this.addSkill(SKILLS.shadowstep);
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!player.alive) {
      body.setVelocityX(0);
      return;
    }

    const dist = this.distanceTo(player);
    if (dist >= this.aggroRadius && this.state !== "aggro") {
      this.state = "idle";
      body.setVelocityX(0);
      return;
    }
    this.state = "aggro";

    // Shadowstep: bail when the player is right on top of us.
    if (dist < PANIC_RANGE && this.castSkill(SKILLS.shadowstep, now)) {
      return;
    }

    const speed = this.moveSpeedPx();
    if (dist < HARASS_RANGE) {
      // Keep harassing distance — sidestep away a bit.
      const dir = player.x < this.sprite.x ? 1 : -1;
      body.setVelocityX(speed * 0.6 * dir);
      this.sprite.setFlipX(player.x < this.sprite.x);
    } else {
      const dir = player.x < this.sprite.x ? -1 : 1;
      body.setVelocityX(speed * dir);
      this.sprite.setFlipX(dir === -1);
      if (player.y < this.sprite.y - 40) this.tryJump();
    }
  }
}
