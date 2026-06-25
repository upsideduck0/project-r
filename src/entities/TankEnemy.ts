import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";
import { computeStatsAtLevel } from "../systems/stats/formulas";

const TANK_ATTRS = { VIT: 22, MIG: 10, AGI: 2, INT: 2, INS: 2, PRE: 4 };
const TANK_STATS = computeStatsAtLevel(TANK_ATTRS, 10);

const ALLY_THREAT_RANGE = 160;
const SLAM_RANGE = 115;
const SLAM_BONUS_DMG = 10;

export class TankEnemy extends Enemy {
  private cachedVx = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-tank",
      kind: "tank",
      aggroRadius: 320,
      bodyW: 26,
      bodyH: 34,
      bodyOffX: 2,
      bodyOffY: 2,
      knockbackResist: 0.85,
      hpBarWidth: 56,
      respawnMs: 6000,
      trackingDelayMs: 500,
      attributes: TANK_ATTRS,
      mainStats: TANK_STATS.main,
      subStats: TANK_STATS.sub,
      heldWeaponTexture: "wpn-tower-shield",
      heldWeaponScale: 1,
      heldWeaponOffsetX: 14,
      heldWeaponOffsetY: 0,
      heldWeaponRotation: 0,
    });
    this.addSkill(SKILLS.protect);
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
      if (this.shouldProtect(player) && this.castSkill(SKILLS.protect, now)) {
        return;
      }
      const dist = this.distanceTo(player);
      const speed = this.moveSpeedPx();
      if (dist < this.aggroRadius) {
        this.state = "aggro";
        const dir = player.x < this.sprite.x ? -1 : 1;
        this.cachedVx = speed * dir;
        this.sprite.setFlipX(dir === -1);
      } else {
        this.state = "idle";
        this.cachedVx = 0;
      }
    }

    body.setVelocityX(this.cachedVx);
    if (this.state === "aggro" && player.y < this.sprite.y - 40) this.tryJump();

    if (this.state === "aggro") this.performSlam(now, player);
  }

  private performSlam(now: number, player: PlayerView): void {
    if (this.distanceTo(player) > SLAM_RANGE) return;
    const dmg = this.tryAttackPlayer(now, { vit: player.vit, def: player.def });
    if (dmg === null) return;

    // Shockwave visual at feet
    const sx = this.sprite.x;
    const sy = this.sprite.y + 10;
    const wave = this.scene.add.circle(sx, sy, 8, 0xffffff, 0.55)
      .setStrokeStyle(2, 0xaaaaff, 0.8)
      .setDepth(15);
    this.scene.tweens.add({
      targets: wave,
      radius: SLAM_RANGE,
      alpha: 0,
      duration: 340,
      ease: "Sine.easeOut",
      onComplete: () => wave.destroy(),
    });

    this.ability?.damagePlayerInRange(SLAM_RANGE, dmg + SLAM_BONUS_DMG, 200, -300);
  }

  private shouldProtect(player: PlayerView): boolean {
    if (!this.ability) return false;
    for (const ally of this.ability.allies()) {
      const d = Phaser.Math.Distance.Between(
        ally.sprite.x, ally.sprite.y, player.x, player.y,
      );
      if (d < ALLY_THREAT_RANGE) return true;
    }
    return false;
  }
}
