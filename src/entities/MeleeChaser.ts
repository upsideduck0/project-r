import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";

const CHASE_SPEED = 110;
const LEASH_DISTANCE = 360;

export class MeleeChaser extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
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
    });
  }

  protected tick(_now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    if (!player.alive) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      return;
    }

    const dist = this.distanceTo(player);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const homeDist = Math.abs(this.sprite.x - this.spawnX);

    if (dist < this.aggroRadius || (this.state === "aggro" && dist < LEASH_DISTANCE)) {
      this.state = "aggro";
      const dir = player.x < this.sprite.x ? -1 : 1;
      body.setVelocityX(CHASE_SPEED * dir);
      this.sprite.setFlipX(dir === -1);
    } else {
      this.state = "idle";
      if (homeDist > 6) {
        const dir = this.spawnX < this.sprite.x ? -1 : 1;
        body.setVelocityX(40 * dir);
        this.sprite.setFlipX(dir === -1);
      } else {
        body.setVelocityX(0);
      }
    }
  }
}
