import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";

const CHASE_SPEED = 110;
const LEASH_DISTANCE = 360;

export class MeleeChaser extends Enemy {
  chaseCheckInterval: number;
  private lastChaseCheck = -Infinity;
  private cachedVx = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, chaseCheckInterval = 0) {
    super(scene, x, y, {
      textureKey: "px-chaser",
      maxHp: 60,
      aggroRadius: 240,
      contactDamage: 10,
      bodyW: 18,
      bodyH: 26,
      bodyOffX: 2,
      bodyOffY: 2,
      respawnMs: 3500,
      kind: "chaser",
      attributes: { VIT: 6, MIG: 8, AGI: 10, INT: 2, INS: 2, PRE: 2 },
    });
    this.chaseCheckInterval = chaseCheckInterval;
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    if (!player.alive) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      this.cachedVx = 0;
      return;
    }

    if (now - this.lastChaseCheck >= this.chaseCheckInterval) {
      this.lastChaseCheck = now;
      const dist = this.distanceTo(player);
      const homeDist = Math.abs(this.sprite.x - this.spawnX);

      if (dist < this.aggroRadius || (this.state === "aggro" && dist < LEASH_DISTANCE)) {
        this.state = "aggro";
        const dir = player.x < this.sprite.x ? -1 : 1;
        this.cachedVx = CHASE_SPEED * dir;
        this.sprite.setFlipX(dir === -1);
      } else {
        this.state = "idle";
        if (homeDist > 6) {
          const dir = this.spawnX < this.sprite.x ? -1 : 1;
          this.cachedVx = 40 * dir;
          this.sprite.setFlipX(dir === -1);
        } else {
          this.cachedVx = 0;
        }
      }
    }

    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(this.cachedVx);
  }
}
