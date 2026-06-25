import Phaser from "phaser";
import { Enemy, PlayerView } from "./Enemy";
import { SKILLS } from "../data/skills";
import { computeStatsAtLevel } from "../systems/stats/formulas";

const CASTER_ATTRS = { VIT: 4, MIG: 2, AGI: 6, INT: 18, INS: 12, PRE: 4 };
const CASTER_STATS = computeStatsAtLevel(CASTER_ATTRS, 10);

const ATTACK_RANGE = 360; // x-distance from player a platform must be within
const HOP_TRIGGER = 200; // hop when the player gets this close
const HOP_COOLDOWN_MS = 2000;
const HOP_STA_COST = 100;
const FLOOR_Y = 430; // sprite y above this threshold = on a platform (lower
                     // platform sits at center y=410 → sprite rests near 392)

// Caster: stays on a platform lobbing orb volleys (mana_release) and hops to a
// further platform when the player gets close. If knocked or pushed onto the
// floor, immediately hops back to a platform that still has the player in
// shooting range — "all platform moving behavior should only move to the
// platform that makes sure the caster can still shoot the player".
export class RangedEnemy extends Enemy {
  private isHopping = false;
  private lastHopAt = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-ranged",
      kind: "caster",
      aggroRadius: 440,
      bodyW: 18,
      bodyH: 26,
      bodyOffX: 2,
      bodyOffY: 2,
      respawnMs: 4500,
      trackingDelayMs: 500,
      attributes: CASTER_ATTRS,
      mainStats: CASTER_STATS.main,
      subStats: CASTER_STATS.sub,
      heldWeaponTexture: "wpn-wooden-staff",
      heldWeaponScale: 1,
      heldWeaponOffsetX: 9,
      heldWeaponOffsetY: 2,
      heldWeaponRotation: 0.25,
    });
    this.addSkill(SKILLS.mana_release);
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    if (this.isHopping || this.state === "hurt") return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!player.alive) {
      body.setVelocityX(0);
      return;
    }

    const grounded = body.blocked.down || body.touching.down;

    // Fall-off recovery: as soon as we're on the floor, hop back to a
    // platform that keeps the player in shooting range.
    if (grounded && this.sprite.y > FLOOR_Y) {
      if (this.sta >= HOP_STA_COST) {
        const plat = this.pickShootingPlatform(player);
        if (plat) {
          this.sta -= HOP_STA_COST;
          this.hopToPlatform(plat);
        }
      }
      return;
    }

    if (this.shouldTrack(now)) {
      this.sprite.setFlipX(player.x < this.sprite.x);
      const dist = this.distanceTo(player);

      // Proximity hop: player too close — leap to a further safe platform.
      if (dist < HOP_TRIGGER && grounded && now - this.lastHopAt > HOP_COOLDOWN_MS && this.sta >= HOP_STA_COST) {
        const plat = this.pickShootingPlatform(player);
        if (plat && Math.abs(plat.x - this.sprite.x) > 60) {
          this.sta -= HOP_STA_COST;
          this.lastHopAt = now;
          this.hopToPlatform(plat);
          return;
        }
      }

      if (dist < ATTACK_RANGE) {
        this.state = "aggro";
        this.castSkill(SKILLS.mana_release, now);
      } else {
        this.state = "idle";
      }
    }

    if (grounded) body.setVelocityX(0);
  }

  // Picks the platform that gives the caster the most distance from the
  // player while still being within shooting range. If nothing is in range,
  // settles for the closest in-range platform we can find.
  private pickShootingPlatform(
    player: PlayerView,
  ): { x: number; y: number } | null {
    const plats = this.ability?.platformTops() ?? [];
    if (plats.length === 0) return null;
    const inRange = plats.filter(
      (p) => Math.abs(p.x - player.x) <= ATTACK_RANGE,
    );
    const pool = inRange.length > 0 ? inRange : plats;
    let best = pool[0];
    let bestDistFromPlayer = -1;
    for (const p of pool) {
      const d = Math.abs(p.x - player.x);
      if (d > bestDistFromPlayer) {
        bestDistFromPlayer = d;
        best = p;
      }
    }
    return best;
  }

  // Parabolic arc to the target platform. Body is disabled mid-flight so the
  // tween position is authoritative; re-enabled on landing.
  private hopToPlatform(target: { x: number; y: number }): void {
    this.isHopping = true;
    this.state = "aggro";
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const ex = target.x;
    const ey = target.y;
    const peak = Math.max(80, Math.abs(sy - ey) + 60);
    this.sprite.setFlipX(ex < sx);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 450,
      ease: "Linear",
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        this.sprite.x = sx + (ex - sx) * p;
        const lin = sy + (ey - sy) * p;
        const arc = -4 * peak * p * (1 - p);
        this.sprite.y = lin + arc;
      },
      onComplete: () => {
        this.sprite.x = ex;
        this.sprite.y = ey;
        body.enable = true;
        body.setVelocity(0, 0);
        this.isHopping = false;
      },
    });
  }
}
