import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { ProjectileSpawnConfig } from "../systems/Projectiles";

// Archer: a physical ranged enemy. Where the caster lobs straight magic
// bolts, the archer fires arrows that travel fast then arc downward (gravity
// after a short delay), so it leads and rains shots from a longer range.
const FIRE_COOLDOWN_MS = 1300;
const PREFERRED_DISTANCE = 330;
const KITE_SPEED = 60;
const ARROW_SPEED = 480;

export class ArcherEnemy extends Enemy {
  fireProjectile?: (cfg: ProjectileSpawnConfig) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-archer",
      kind: "archer",
      maxHp: 50,
      aggroRadius: 440,
      contactDamage: 6,
      bodyW: 18,
      bodyH: 28,
      bodyOffX: 2,
      bodyOffY: 2,
      hpBarWidth: 34,
      respawnMs: 4000,
      attackCooldownMs: FIRE_COOLDOWN_MS,
      attributes: { VIT: 5, MIG: 7, AGI: 12, INT: 6, INS: 8, PRE: 3 },
    });
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!player.alive) {
      body.setVelocityX(0);
      return;
    }

    const dist = this.distanceTo(player);
    if (dist >= this.aggroRadius) {
      this.state = "idle";
      body.setVelocityX(0);
      return;
    }

    this.state = "aggro";
    const dirSign: 1 | -1 = player.x < this.sprite.x ? -1 : 1;
    this.sprite.setFlipX(dirSign === -1);

    const speed = KITE_SPEED * this.getMoveSpeedMult();
    if (dist < PREFERRED_DISTANCE - 40) {
      body.setVelocityX(-dirSign * speed);
    } else if (dist > PREFERRED_DISTANCE + 40) {
      body.setVelocityX(dirSign * speed);
    } else {
      body.setVelocityX(0);
    }

    const dmg = this.tryAttackPlayer(now);
    if (dmg !== null && this.fireProjectile) {
      const ox = this.sprite.x + dirSign * 10;
      const oy = this.sprite.y - 4;
      let dx = player.x - ox;
      let dy = player.y - oy - 30; // aim a touch high; the arc drops it in
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      this.fireProjectile({
        x: ox,
        y: oy,
        vx: dx * ARROW_SPEED,
        vy: dy * ARROW_SPEED,
        damage: 9,
        texture: "proj-arrow",
        range: 620,
        rotation: Math.atan2(dy, dx),
        knockX: 90,
        knockY: -40,
        homingTurnRate: 0,
        gravityAfterMs: 240,
        piercing: false,
        glowTint: 0,
        glowFrequencyMs: 0,
        glowLifespanMs: 0,
      });
    }
  }
}
