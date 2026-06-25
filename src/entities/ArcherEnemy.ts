import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";

// Archer: a physical ranged enemy. Where the caster lobs magic orbs, the
// archer fires arrows that travel fast then arc downward (gravity after a
// short delay), kiting at range. Fires via the injected ability context.
const PREFERRED_DISTANCE = 330;
const ARROW_SPEED = 480;

export class ArcherEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-archer",
      kind: "archer",
      aggroRadius: 440,
      bodyW: 18,
      bodyH: 28,
      bodyOffX: 2,
      bodyOffY: 2,
      hpBarWidth: 34,
      respawnMs: 4000,
      trackingDelayMs: 500,
      attributes: { VIT: 5, MIG: 7, AGI: 12, INT: 6, INS: 8, PRE: 3 },
      mainStats: {
        HP: 25, MP: 30, STA: 20, ATK: 9, DEF: 4, MS: 1.7, AS: 2, TEN: 0,
      },
      subStats: { GEN: 2 },
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

    const speed = this.moveSpeedPx();
    if (dist < PREFERRED_DISTANCE - 40) body.setVelocityX(-dirSign * speed);
    else if (dist > PREFERRED_DISTANCE + 40) body.setVelocityX(dirSign * speed);
    else body.setVelocityX(0);

    const dmg = this.tryAttackPlayer(now);
    if (dmg !== null && this.ability) {
      const ox = this.sprite.x + dirSign * 10;
      const oy = this.sprite.y - 4;
      let dx = player.x - ox;
      let dy = player.y - oy - 30; // aim a touch high; the arc drops it in
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      this.ability.spawnProjectile({
        x: ox,
        y: oy,
        vx: dx * ARROW_SPEED,
        vy: dy * ARROW_SPEED,
        damage: dmg,
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
