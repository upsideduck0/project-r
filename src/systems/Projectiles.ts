import Phaser from "phaser";

export interface ProjectileSpawnConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  texture: string;
  range: number;
  rotation: number;
  knockX: number;
  knockY: number;
  homingTurnRate: number;
  glowTint: number;
}

export class ProjectileSystem {
  private group: Phaser.Physics.Arcade.Group;
  private toKill = new Set<Phaser.Physics.Arcade.Image>();

  constructor(private scene: Phaser.Scene) {
    this.group = scene.physics.add.group({
      allowGravity: false,
      collideWorldBounds: false,
    });
  }

  getGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }

  spawn(cfg: ProjectileSpawnConfig): void {
    const p = this.group.create(
      cfg.x,
      cfg.y,
      cfg.texture,
    ) as Phaser.Physics.Arcade.Image;
    p.setVelocity(cfg.vx, cfg.vy);
    p.setRotation(cfg.rotation);
    p.setData("damage", cfg.damage);
    p.setData("originX", cfg.x);
    p.setData("originY", cfg.y);
    p.setData("range", cfg.range);
    p.setData("knockX", cfg.knockX);
    p.setData("knockY", cfg.knockY);
    p.setData("turnRate", cfg.homingTurnRate);
    p.setData("hit", false);
    (p.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    if (cfg.glowTint) {
      const emitter = this.scene.add.particles(0, 0, cfg.texture, {
        follow: p,
        lifespan: 320,
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0.55, end: 0 },
        tint: cfg.glowTint,
        frequency: 26,
        blendMode: "ADD",
      });
      emitter.setDepth(p.depth - 1);
      p.setData("emitter", emitter);
    }
  }

  markForDestroy(p: Phaser.Physics.Arcade.Image): void {
    if (p && p.active) this.toKill.add(p);
  }

  update(dt: number): void {
    const pointer = this.scene.input.activePointer;
    const cx = pointer.worldX;
    const cy = pointer.worldY;

    const snapshot = this.group.getChildren().slice();
    for (const obj of snapshot) {
      const p = obj as Phaser.Physics.Arcade.Image;
      if (!p.active || this.toKill.has(p)) continue;

      const ox = p.getData("originX") as number;
      const oy = p.getData("originY") as number;
      const r = p.getData("range") as number;
      const dx = p.x - ox;
      const dy = p.y - oy;
      if (dx * dx + dy * dy > r * r) {
        this.toKill.add(p);
        continue;
      }

      const turnRate = p.getData("turnRate") as number;
      if (turnRate > 0) {
        const body = p.body as Phaser.Physics.Arcade.Body;
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed > 1) {
          const desired = Math.atan2(cy - p.y, cx - p.x);
          const current = Math.atan2(body.velocity.y, body.velocity.x);
          let diff = desired - current;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          const maxTurn = turnRate * dt;
          const turn = Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
          const next = current + turn;
          body.setVelocity(Math.cos(next) * speed, Math.sin(next) * speed);
          p.setRotation(next);
        }
      }
    }

    if (this.toKill.size > 0) {
      for (const p of this.toKill) this.killNow(p);
      this.toKill.clear();
    }
  }

  private killNow(p: Phaser.Physics.Arcade.Image): void {
    if (!p.active) return;
    const emitter = p.getData("emitter") as
      | Phaser.GameObjects.Particles.ParticleEmitter
      | undefined;
    if (emitter) {
      emitter.stop();
      this.scene.time.delayedCall(400, () => {
        if (emitter && emitter.scene) emitter.destroy();
      });
    }
    p.destroy();
  }
}
