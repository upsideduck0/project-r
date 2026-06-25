import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";

const FIGHTER_SPEED = 140;
const LEASH = 360;

export class FighterEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-fighter",
      kind: "fighter",
      maxHp: 80,
      aggroRadius: 280,
      contactDamage: 12,
      bodyW: 20,
      bodyH: 30,
      bodyOffX: 2,
      bodyOffY: 2,
      hpBarWidth: 38,
      respawnMs: 3500,
      attackCooldownMs: 850,
    });
  }

  protected tick(_now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!player.alive) {
      body.setVelocityX(0);
      return;
    }
    const dist = this.distanceTo(player);
    const speed = FIGHTER_SPEED * this.getMoveSpeedMult();
    if (
      dist < this.aggroRadius ||
      (this.state === "aggro" && dist < LEASH)
    ) {
      this.state = "aggro";
      const dir = player.x < this.sprite.x ? -1 : 1;
      body.setVelocityX(speed * dir);
      this.sprite.setFlipX(dir === -1);
    } else {
      this.state = "idle";
      body.setVelocityX(0);
    }
  }
}
