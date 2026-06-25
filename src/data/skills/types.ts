// Formal skill framework — type layer.
//
// Every skill is three layers:
//   1. Core      — identity, costs, gating, tags, complexity
//   2. Scaling   — how the six attributes amplify the skill
//   3. Type Data — optional blocks describing *what the skill does*
//
// Execution is driven entirely by which Type Data blocks are present (see
// executor.ts), so adding a new skill means adding data, not code.

import { AttributeKey, AttributeSet, StatKey } from "../../systems/stats/types";
import { ProjectileSpawnConfig } from "../../systems/Projectiles";

// ----- Tags & rarity -----

export type SkillTag =
  | "projectile"
  | "melee"
  | "movement"
  | "summon"
  | "aura"
  | "heal"
  | "buff"
  | "debuff"
  | "channel";

export type SkillRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

// ----- Requirements & scaling (generic, reusable) -----

export type AttributeRequirements = Partial<Record<AttributeKey, number>>;
export type AttributeScaling = Partial<Record<AttributeKey, number>>;

// ----- 1. Core -----

export interface SkillCore {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: SkillRarity;

  manaCost: number;
  cooldownMs: number;
  castTimeMs: number;

  requirements: AttributeRequirements;
  tags: SkillTag[];

  // Internal-only authoring/budget signal. Never shown to players; used later
  // by loot generation, AI usage, balance evaluation, reward systems.
  complexity: number;
}

// ----- 3. Type Data blocks -----

export interface ProjectileSkillData {
  baseDamage: number;
  count: number;
  speed: number;
  lifetimeMs: number;
  pierce: number;
  bounce: number;
  homing: number;
  // Engine/visual extras. Optional so a spec-pure skill can omit them; the
  // executor falls back to sane defaults.
  texture?: string;
  spreadDeg?: number;
  knockX?: number;
  knockY?: number;
  glowTint?: number;
  glowFrequencyMs?: number;
  glowLifespanMs?: number;
}

export interface MeleeSkillData {
  baseDamage: number;
  range: number;
  swingArcDeg: number;
  hitCount: number;
  knockback: number;
}

export interface DashSkillData {
  distance: number;
  durationMs: number;
  invulnMs: number;
  flashColor?: number;
}

export interface SummonSkillData {
  summonType: string;
  durationMs: number;
  maxActive: number;
  summonHp: number;
  summonAtk: number;
}

export interface AuraSkillData {
  radius: number;
  tickRateMs: number;
  durationMs: number;
  baseDamage?: number; // for damaging auras
  baseHeal?: number; // for healing auras (e.g. Holy Nova)
}

export type BuffResource = "hp" | "mp" | "sta";

export interface SkillStatMod {
  stat: StatKey;
  op: "flat" | "percent";
  value: number;
}

// Buff and Debuff share a shape; a Debuff is simply applied to targets rather
// than the caster. durationMs === 0 means an instant effect.
export interface BuffSkillData {
  durationMs: number;
  effectStrength: number;
  tickRateMs?: number;
  // Instant or over-time resource change (heal / mana / stamina). The amount
  // used is effectStrength.
  resource?: BuffResource;
  // Stat modifiers applied for durationMs.
  statMods?: SkillStatMod[];
  flashColor?: number;
}

export type DebuffSkillData = BuffSkillData;

// ----- Assembled skill -----

export interface SkillDef {
  core: SkillCore;
  scaling: AttributeScaling;
  projectile?: ProjectileSkillData;
  melee?: MeleeSkillData;
  dash?: DashSkillData;
  summon?: SummonSkillData;
  aura?: AuraSkillData;
  buff?: BuffSkillData;
  debuff?: DebuffSkillData;
}

// ----- Caster surface -----
//
// The executor performs effects through this interface, so it stays decoupled
// from the scene. Optional hooks let future type-data blocks (melee / aura /
// summon / timed buffs) light up without touching the executor — if a hook is
// absent that effect is simply a no-op for now.

export interface PlayerHandle {
  x: number;
  y: number;
  facing: 1 | -1;
}

export interface SkillCaster {
  player(): PlayerHandle;
  cursor(): { x: number; y: number };
  healPlayer(amount: number): void;
  restoreMana(amount: number): void;
  restoreStamina(amount: number): void;
  blinkPlayer(distancePx: number): void;
  applyInvulnFor(ms: number): void;
  spawnPlayerProjectile(cfg: ProjectileSpawnConfig): void;
  flashPlayer(color: number, ms: number): void;

  // Future injection points (optional):
  spawnMeleeHitbox?(opts: {
    damage: number;
    range: number;
    arcDeg: number;
    hitCount: number;
    knockback: number;
  }): void;
  spawnAura?(opts: {
    radius: number;
    tickRateMs: number;
    durationMs: number;
    damage: number;
    heal: number;
  }): void;
  spawnSummon?(opts: {
    summonType: string;
    durationMs: number;
    maxActive: number;
    hp: number;
    atk: number;
  }): void;
  applyTimedSelfBuff?(mods: SkillStatMod[], durationMs: number): void;
}

export type { AttributeSet };
