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
}

export class ProjectileSystem {
  private group: Phaser.Physics.Arcade.Group;

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
    (p.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
  }

  update(): void {
    this.group.children.iterate((obj) => {
      const p = obj as Phaser.Physics.Arcade.Image;
      if (!p.active) return true;
      const ox = p.getData("originX") as number;
      const oy = p.getData("originY") as number;
      const r = p.getData("range") as number;
      const dx = p.x - ox;
      const dy = p.y - oy;
      if (dx * dx + dy * dy > r * r) p.destroy();
      return true;
    });
  }
}
