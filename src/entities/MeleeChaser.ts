import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";

const LEASH_DISTANCE = 360;

export class MeleeChaser extends Enemy {
  private cachedVx = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-chaser",
      kind: "chaser",
      aggroRadius: 240,
      bodyW: 18,
      bodyH: 26,
      bodyOffX: 2,
      bodyOffY: 2,
      respawnMs: 3500,
      trackingDelayMs: 500,
      attributes: { VIT: 6, MIG: 8, AGI: 10, INT: 2, INS: 2, PRE: 2 },
      mainStats: {
        HP: 60, MP: 0, STA: 20, ATK: 10, DEF: 5, MS: 3.1, AS: 3, TEN: 0,
      },
      subStats: { GEN: 1 },
      heldWeaponTexture: "wpn-wooden-sword",
      heldWeaponScale: 1,
      heldWeaponOffsetX: 10,
      heldWeaponOffsetY: 4,
      heldWeaponRotation: 0.35,
    });
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!player.alive) {
      body.setVelocityX(0);
      this.cachedVx = 0;
      return;
    }

    if (this.shouldTrack(now)) {
      const dist = this.distanceTo(player);
      const homeDist = Math.abs(this.sprite.x - this.spawnX);
      const speed = this.moveSpeedPx();

      if (dist < this.aggroRadius || (this.state === "aggro" && dist < LEASH_DISTANCE)) {
        this.state = "aggro";
        const dir = player.x < this.sprite.x ? -1 : 1;
        this.cachedVx = speed * dir;
        this.sprite.setFlipX(dir === -1);
      } else {
        this.state = "idle";
        if (homeDist > 6) {
          const dir = this.spawnX < this.sprite.x ? -1 : 1;
          this.cachedVx = speed * 0.4 * dir;
          this.sprite.setFlipX(dir === -1);
        } else {
          this.cachedVx = 0;
        }
      }
    }

    body.setVelocityX(this.cachedVx);
    if (this.state === "aggro" && player.y < this.sprite.y - 40) this.tryJump();
  }
}
