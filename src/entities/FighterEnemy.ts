import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";

const MELEE_RANGE = 60;
const LEASH = 360;

export class FighterEnemy extends Enemy {
  private cachedVx = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-fighter",
      kind: "fighter",
      aggroRadius: 300,
      bodyW: 20,
      bodyH: 30,
      bodyOffX: 2,
      bodyOffY: 2,
      hpBarWidth: 38,
      respawnMs: 3500,
      trackingDelayMs: 500,
      attributes: { VIT: 8, MIG: 14, AGI: 8, INT: 0, INS: 0, PRE: 0 },
      mainStats: {
        HP: 50, MP: 30, STA: 24, ATK: 18, DEF: 12, MS: 4, AS: 3, TEN: 6,
      },
      subStats: { GEN: 3 },
    });
    this.addSkill(SKILLS.battle_rush);
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
      const aggro = dist < this.aggroRadius || (this.state === "aggro" && dist < LEASH);
      if (!aggro) {
        this.state = "idle";
        this.cachedVx = 0;
      } else {
        this.state = "aggro";
        // Battle Rush: close the gap when out of melee reach.
        if (dist > MELEE_RANGE && this.castSkill(SKILLS.battle_rush, now)) {
          return;
        }
        const dir = player.x < this.sprite.x ? -1 : 1;
        this.cachedVx = this.moveSpeedPx() * dir;
        this.sprite.setFlipX(dir === -1);
      }
    }

    body.setVelocityX(this.cachedVx);
    if (this.state === "aggro" && player.y < this.sprite.y - 40) this.tryJump();
  }
}
