import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";

const TANK_SPEED = 50;

export class TankEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-tank",
      kind: "tank",
      maxHp: 220,
      aggroRadius: 320,
      contactDamage: 22,
      bodyW: 26,
      bodyH: 34,
      bodyOffX: 2,
      bodyOffY: 2,
      knockbackResist: 0.85,
      hpBarWidth: 56,
      respawnMs: 6000,
      attackCooldownMs: 1300,
      attributes: { VIT: 22, MIG: 10, AGI: 3, INT: 2, INS: 2, PRE: 4 },
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
    const speed = TANK_SPEED * this.getMoveSpeedMult();
    if (dist < this.aggroRadius) {
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
