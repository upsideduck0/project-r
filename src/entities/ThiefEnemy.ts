import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";
import { computeStatsAtLevel } from "../systems/stats/formulas";

const THIEF_ATTRS = { VIT: 4, MIG: 6, AGI: 22, INT: 2, INS: 2, PRE: 4 };
const THIEF_STATS = computeStatsAtLevel(THIEF_ATTRS, 10);

const HARASS_RANGE = 180;
const MELEE_RANGE = 64;
const HITS_BEFORE_RETREAT = 2;

// Thief: harasses at range while shadowstep is on cooldown, then leaps onto
// the player and tries to land a couple of strikes. After taking ~2 hits in
// aggressive mode, retreats back to harass distance until shadowstep refreshes.
export class ThiefEnemy extends Enemy {
  private cachedVx = 0;
  private aggressive = false;
  private hitsInAggro = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-thief",
      kind: "thief",
      aggroRadius: 360,
      bodyW: 14,
      bodyH: 24,
      bodyOffX: 1,
      bodyOffY: 2,
      hpBarWidth: 28,
      respawnMs: 3500,
      trackingDelayMs: 100,
      attributes: THIEF_ATTRS,
      mainStats: THIEF_STATS.main,
      subStats: THIEF_STATS.sub,
      heldWeaponTexture: "wpn-dagger",
      heldWeaponScale: 1,
      heldWeaponOffsetX: 8,
      heldWeaponOffsetY: 4,
      heldWeaponRotation: 0.35,
    });
    this.addSkill(SKILLS.shadowstep);
  }

  takeDamage(amount: number, knockX: number, knockY: number): void {
    super.takeDamage(amount, knockX, knockY);
    if (!this.alive) return;
    if (this.aggressive) {
      this.hitsInAggro++;
      if (this.hitsInAggro >= HITS_BEFORE_RETREAT) {
        this.aggressive = false;
        this.hitsInAggro = 0;
      }
    }
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
      if (dist >= this.aggroRadius && this.state !== "aggro") {
        this.state = "idle";
        this.cachedVx = 0;
      } else {
        this.state = "aggro";
        // When shadowstep is ready, leap onto the player and go aggressive.
        if (!this.aggressive && this.castSkill(SKILLS.shadowstep, now)) {
          this.aggressive = true;
          this.hitsInAggro = 0;
          this.tryAttackPlayer(now, { vit: player.vit, def: player.def });
          return;
        }
        const speed = this.moveSpeedPx();
        if (this.aggressive) {
          // Chase the player and try to land contact strikes.
          if (dist > MELEE_RANGE) {
            const dir = player.x < this.sprite.x ? -1 : 1;
            this.cachedVx = speed * dir;
            this.sprite.setFlipX(dir === -1);
          } else {
            this.cachedVx = 0;
            this.sprite.setFlipX(player.x < this.sprite.x);
            this.tryAttackPlayer(now, { vit: player.vit, def: player.def });
          }
        } else if (dist < HARASS_RANGE) {
          // Harass: keep distance, side-stepping back from the player.
          const dir = player.x < this.sprite.x ? 1 : -1;
          this.cachedVx = speed * 0.6 * dir;
          this.sprite.setFlipX(player.x < this.sprite.x);
        } else {
          // Close in slowly until in harass range.
          const dir = player.x < this.sprite.x ? -1 : 1;
          this.cachedVx = speed * 0.7 * dir;
          this.sprite.setFlipX(dir === -1);
        }
      }
    }

    body.setVelocityX(this.cachedVx);
    if (this.state === "aggro" && player.y < this.sprite.y - 40) this.tryJump();
  }
}
