import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { ProjectileSpawnConfig } from "../systems/Projectiles";

const FIRE_COOLDOWN_MS = 1500;
const PREFERRED_DISTANCE = 240;
const KITE_SPEED = 70;
const PROJECTILE_SPEED = 360;

export class RangedEnemy extends Enemy {
  fireProjectile?: (cfg: ProjectileSpawnConfig) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-ranged",
      maxHp: 45,
      aggroRadius: 380,
      contactDamage: 6,
      bodyW: 18,
      bodyH: 26,
      bodyOffX: 2,
      bodyOffY: 2,
      respawnMs: 4500,
    });
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    if (!player.alive) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      return;
    }

    const dist = this.distanceTo(player);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (dist >= this.aggroRadius) {
      this.state = "idle";
      body.setVelocityX(0);
      return;
    }

    this.state = "aggro";
    const dirSign: 1 | -1 = player.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(dirSign === -1);

    if (dist < PREFERRED_DISTANCE - 30) {
      body.setVelocityX(-dirSign * KITE_SPEED);
    } else if (dist > PREFERRED_DISTANCE + 30) {
      body.setVelocityX(dirSign * KITE_SPEED);
    } else {
      body.setVelocityX(0);
    }

    if (now - this.lastAttackAt >= FIRE_COOLDOWN_MS && this.fireProjectile) {
      this.lastAttackAt = now;
      const ox = this.sprite.x + dirSign * 8;
      const oy = this.sprite.y - 2;
      let dx = player.x - ox;
      let dy = player.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      this.fireProjectile({
        x: ox,
        y: oy,
        vx: dx * PROJECTILE_SPEED,
        vy: dy * PROJECTILE_SPEED,
        damage: 8,
        texture: "proj-enemy-shot",
        range: 480,
        rotation: Math.atan2(dy, dx),
        knockX: 80,
        knockY: -60,
        homingTurnRate: 0,
        gravityAfterMs: 0,
        piercing: false,
        glowTint: 0xff6f7a,
        glowFrequencyMs: 22,
        glowLifespanMs: 280,
      });
    }
  }
}
