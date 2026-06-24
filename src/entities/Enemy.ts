import Phaser from "phaser";

export type EnemyState = "idle" | "aggro" | "attack" | "hurt" | "dead";

export interface EnemyConfig {
  textureKey: string;
  maxHp: number;
  aggroRadius: number;
  contactDamage: number;
  bodyW: number;
  bodyH: number;
  bodyOffX: number;
  bodyOffY: number;
  knockbackResist?: number;
  hpBarWidth?: number;
  respawnMs?: number;
}

export interface PlayerView {
  x: number;
  y: number;
  facing: 1 | -1;
  alive: boolean;
}

const KNOCKBACK_MS = 220;
const KNOCKBACK_STOP_EPSILON = 16;

export abstract class Enemy {
  scene: Phaser.Scene;
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  maxHp: number;
  aggroRadius: number;
  contactDamage: number;
  state: EnemyState = "idle";
  knockbackEndAt = 0;
  lastHurtAt = -Infinity;
  lastAttackAt = -Infinity;
  spawnX: number;
  spawnY: number;
  alive = true;
  private knockbackResist: number;
  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private hpBarWidth: number;
  private hpBarOffsetY: number;
  private respawnMs: number;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: EnemyConfig) {
    this.scene = scene;
    this.spawnX = x;
    this.spawnY = y;
    this.maxHp = cfg.maxHp;
    this.hp = cfg.maxHp;
    this.aggroRadius = cfg.aggroRadius;
    this.contactDamage = cfg.contactDamage;
    this.knockbackResist = cfg.knockbackResist ?? 0;
    this.hpBarWidth = cfg.hpBarWidth ?? 32;
    this.respawnMs = cfg.respawnMs ?? 3500;

    this.sprite = scene.physics.add.sprite(x, y, cfg.textureKey);
    this.sprite.setCollideWorldBounds(true);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(cfg.bodyW, cfg.bodyH).setOffset(cfg.bodyOffX, cfg.bodyOffY);
    body.setDragX(1400);
    body.setMaxVelocity(420, 900);
    this.sprite.setData("enemy", this);

    this.hpBarOffsetY = -(cfg.bodyH / 2 + 10);
    this.hpBg = scene.add
      .rectangle(
        x,
        y + this.hpBarOffsetY,
        this.hpBarWidth + 2,
        4,
        0x000000,
        0.75,
      )
      .setDepth(900);
    this.hpFill = scene.add
      .rectangle(
        x - this.hpBarWidth / 2,
        y + this.hpBarOffsetY,
        this.hpBarWidth,
        2,
        0xe06070,
        1,
      )
      .setOrigin(0, 0.5)
      .setDepth(901);
  }

  takeDamage(amount: number, knockX: number, knockY: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.lastHurtAt = this.scene.time.now;
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(70, () => this.sprite.clearTint());
    if (knockX !== 0 || knockY !== 0) {
      const mult = 1 - this.knockbackResist;
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(knockX * mult, knockY * mult);
      this.knockbackEndAt = this.scene.time.now + KNOCKBACK_MS;
      this.state = "hurt";
    }
    if (this.hp <= 0) this.die();
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.state = "dead";
    this.sprite.setActive(false).setVisible(false);
    (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.onDeath();
  }

  respawn(): void {
    this.sprite.setPosition(this.spawnX, this.spawnY);
    this.hp = this.maxHp;
    this.alive = true;
    this.state = "idle";
    this.sprite.setActive(true).setVisible(true);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);
  }

  protected onDeath(): void {
    this.scene.time.delayedCall(this.respawnMs, () => this.respawn());
  }

  distanceTo(p: PlayerView): number {
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.x, p.y);
  }

  update(now: number, dt: number, player: PlayerView): void {
    if (!this.alive) return;

    this.hpBg.setPosition(this.sprite.x, this.sprite.y + this.hpBarOffsetY);
    this.hpFill.setPosition(
      this.sprite.x - this.hpBarWidth / 2,
      this.sprite.y + this.hpBarOffsetY,
    );
    this.hpFill.width = this.hpBarWidth * (this.hp / this.maxHp);

    if (now > this.knockbackEndAt) {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      if (Math.abs(body.velocity.x) < KNOCKBACK_STOP_EPSILON) {
        body.setVelocityX(0);
      }
      if (this.state === "hurt") this.state = "idle";
    }

    this.tick(now, dt, player);
  }

  protected tick(_now: number, _dt: number, _player: PlayerView): void {}
}
