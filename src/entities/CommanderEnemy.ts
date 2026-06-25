import Phaser from "phaser";
import { BuffMods, Enemy, PlayerView } from "./Enemy";

const COMMANDER_SPEED = 60;
const DEFAULT_AURA_RADIUS = 220;
const KITE_TRIGGER_DISTANCE = 180;

let commanderCounter = 0;

export const DEFAULT_AURA_BUFFS: Record<string, BuffMods> = {
  tank: { damageReduction: 0.5 },
  fighter: { attackSpeedMult: 1.8 },
  thief: { moveSpeedMult: 1.5 },
};

export interface CommanderOptions {
  auraRadius?: number;
  auraBuffs?: Record<string, BuffMods>;
}

export class CommanderEnemy extends Enemy {
  // Injected by the scene. Should return every other enemy in the world
  // (this commander filters itself out).
  getEnemies?: () => Enemy[];
  auraRadius: number;
  auraBuffs: Record<string, BuffMods>;
  private commanderId: string;
  private buffedEnemies = new Set<Enemy>();
  private auraDisc: Phaser.GameObjects.Arc;
  private nextAuraCheckAt = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: CommanderOptions = {},
  ) {
    super(scene, x, y, {
      textureKey: "px-commander",
      kind: "commander",
      maxHp: 140,
      aggroRadius: 480,
      contactDamage: 10,
      bodyW: 22,
      bodyH: 32,
      bodyOffX: 2,
      bodyOffY: 2,
      knockbackResist: 0.4,
      hpBarWidth: 60,
      respawnMs: 8000,
      attackCooldownMs: 1400,
      attributes: { VIT: 10, MIG: 6, AGI: 6, INT: 8, INS: 8, PRE: 18 },
    });
    this.commanderId = `commander-${++commanderCounter}`;
    this.auraRadius = opts.auraRadius ?? DEFAULT_AURA_RADIUS;
    this.auraBuffs = opts.auraBuffs ?? DEFAULT_AURA_BUFFS;

    this.auraDisc = scene.add
      .circle(x, y, this.auraRadius, 0xffd060, 0.07)
      .setStrokeStyle(2, 0xffd060, 0.55)
      .setDepth(50);
  }

  setAuraBuffs(buffs: Record<string, BuffMods>): void {
    this.auraBuffs = buffs;
    // Force a refresh on the next tick.
    this.nextAuraCheckAt = 0;
    for (const e of this.buffedEnemies) e.removeBuff(this.commanderId);
    this.buffedEnemies.clear();
  }

  protected tick(now: number, _dt: number, player: PlayerView): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.state !== "hurt") {
      if (player.alive && this.distanceTo(player) < KITE_TRIGGER_DISTANCE) {
        // Back away from the player; the commander wants to stay behind
        // its buffed minions.
        const dir = player.x < this.sprite.x ? 1 : -1;
        body.setVelocityX(COMMANDER_SPEED * this.getMoveSpeedMult() * dir);
        this.sprite.setFlipX(dir === 1);
      } else {
        body.setVelocityX(0);
      }
    }

    this.auraDisc.setPosition(this.sprite.x, this.sprite.y);

    if (now >= this.nextAuraCheckAt) {
      this.nextAuraCheckAt = now + 150;
      this.refreshAura();
    }
  }

  private refreshAura(): void {
    if (!this.getEnemies) return;
    const enemies = this.getEnemies();
    const r2 = this.auraRadius * this.auraRadius;
    const insideNow = new Set<Enemy>();
    for (const e of enemies) {
      if (e === this || !e.alive) continue;
      const dx = e.sprite.x - this.sprite.x;
      const dy = e.sprite.y - this.sprite.y;
      if (dx * dx + dy * dy <= r2) insideNow.add(e);
    }
    for (const e of insideNow) {
      if (this.buffedEnemies.has(e)) continue;
      const buff = this.auraBuffs[e.kind];
      if (!buff) continue;
      e.applyBuff(this.commanderId, buff);
      this.buffedEnemies.add(e);
    }
    for (const e of this.buffedEnemies) {
      if (!insideNow.has(e)) {
        e.removeBuff(this.commanderId);
        this.buffedEnemies.delete(e);
      }
    }
  }

  protected onDeath(): void {
    for (const e of this.buffedEnemies) e.removeBuff(this.commanderId);
    this.buffedEnemies.clear();
    this.auraDisc.setVisible(false);
    super.onDeath();
  }

  respawn(): void {
    super.respawn();
    this.auraDisc.setVisible(true);
    this.nextAuraCheckAt = 0;
  }
}
