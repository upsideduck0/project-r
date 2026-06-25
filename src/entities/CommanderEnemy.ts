import Phaser from "phaser";
import { BuffMods, Enemy, PlayerView } from "./Enemy";

const COMMANDER_SPEED = 60;
const KITE_TRIGGER_DISTANCE = 180;

let commanderCounter = 0;

export const DEFAULT_AURA_BUFFS: Record<string, BuffMods> = {
  tank: { damageReduction: 0.5 },
  fighter: { attackSpeedMult: 1.8 },
  thief: { moveSpeedMult: 1.5 },
};

export interface CommanderOptions {
  auraBuffs?: Record<string, BuffMods>;
}

export class CommanderEnemy extends Enemy {
  // Injected by the scene. Should return every other enemy in the world
  // (this commander filters itself out).
  getEnemies?: () => Enemy[];
  auraBuffs: Record<string, BuffMods>;
  private commanderId: string;
  private buffedEnemies = new Set<Enemy>();
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
      maxHp: 500,
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
    this.auraBuffs = opts.auraBuffs ?? DEFAULT_AURA_BUFFS;
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

    if (now >= this.nextAuraCheckAt) {
      this.nextAuraCheckAt = now + 150;
      this.refreshAura();
    }
  }

  // Buff range is the whole map for now: every living enemy of a buffable
  // kind receives the matching buff, regardless of distance.
  private refreshAura(): void {
    if (!this.getEnemies) return;
    const targets = new Set<Enemy>();
    for (const e of this.getEnemies()) {
      if (e === this || !e.alive) continue;
      if (this.auraBuffs[e.kind]) targets.add(e);
    }
    for (const e of targets) {
      if (this.buffedEnemies.has(e)) continue;
      e.applyBuff(this.commanderId, this.auraBuffs[e.kind]);
      this.buffedEnemies.add(e);
    }
    for (const e of this.buffedEnemies) {
      if (!targets.has(e)) {
        e.removeBuff(this.commanderId);
        this.buffedEnemies.delete(e);
      }
    }
  }

  protected onDeath(): void {
    for (const e of this.buffedEnemies) e.removeBuff(this.commanderId);
    this.buffedEnemies.clear();
    super.onDeath();
  }

  respawn(): void {
    super.respawn();
    this.nextAuraCheckAt = 0;
  }
}
