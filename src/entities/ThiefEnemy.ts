import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";

const THIEF_SPEED = 210;
const DART_INTERVAL_MS = 1100;
const DART_DISTANCE = 130;

export class ThiefEnemy extends Enemy {
  private dartTargetX: number;
  private nextDartAt = 0;
  private preferLeft = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-thief",
      kind: "thief",
      maxHp: 32,
      aggroRadius: 360,
      contactDamage: 7,
      bodyW: 14,
      bodyH: 24,
      bodyOffX: 1,
      bodyOffY: 2,
      hpBarWidth: 28,
      respawnMs: 3500,
      attackCooldownMs: 650,
    });
    this.dartTargetX = x;
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
      body.setVelocityX(0);
      this.state = "idle";
      return;
    }
    this.state = "aggro";

    if (now >= this.nextDartAt) {
      this.nextDartAt = now + DART_INTERVAL_MS;
      // Cross to the opposite side of the player each dart, so the thief
      // keeps swapping sides and is hard to track.
      this.preferLeft = !this.preferLeft;
      const side = this.preferLeft ? -1 : 1;
      this.dartTargetX = player.x + side * DART_DISTANCE;
    }

    const speed = THIEF_SPEED * this.getMoveSpeedMult();
    const dx = this.dartTargetX - this.sprite.x;
    if (Math.abs(dx) < 4) {
      body.setVelocityX(0);
    } else {
      const dir = dx < 0 ? -1 : 1;
      body.setVelocityX(speed * dir);
      this.sprite.setFlipX(dir === -1);
    }
  }
}
