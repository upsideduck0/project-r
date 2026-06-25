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

// Direction hints for self-relocation skills. The caster decides what each
// means for itself (e.g. the thief's "away_from_target" teleports away from
// the player; the commander's "to_furthest_platform" hops to a platform far
// from the player). Unknown values are ignored.
export type DashDirection =
  | "facing"
  | "toward_target"
  | "away_from_target"
  | "to_nearest_ally"
  | "to_furthest_platform";

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

  // Visual identity: the attribute whose color is shown on cast. Optional
  // because the executor falls back to the highest-coefficient scaling key.
  dominantAttribute?: AttributeKey;

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
  // Where the caster relocates to. Default "facing".
  direction?: DashDirection;
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
  durationMs: number; // 0 or negative = infinite (passive)
  baseDamage?: number; // for damaging auras
  baseHeal?: number; // for healing auras (e.g. Holy Nova)
  // Different timed stat modifiers per ally kind. Used by buffing auras like
  // command_aura where each minion type receives a tailored effect.
  kindEffects?: Record<string, SkillStatMod[]>;
  // World-wide aura: ignore radius, hide the ring visual. Useful for
  // commander-style "buff the entire battlefield" passives.
  global?: boolean;
}

export type BuffResource = "hp" | "mp" | "sta" | "focus" | "nimble";

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
  // Empower the caster's next attack by this much for durationMs.
  nextAttackBonus?: number;
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
// A generic, actor-relative surface so the SAME skills work for the player,
// enemies, bosses, summons, and future NPCs. The executor performs effects
// through this interface and never knows who is casting. The implementing
// actor decides what "self" / "aim" / a dash direction mean for it.
//
// Optional hooks let advanced type-data blocks (melee / aura / summon / timed
// buffs) light up per-actor; if a hook is absent that effect is a no-op.

export interface CasterSelf {
  x: number;
  y: number;
  facing: 1 | -1;
}

export interface SkillCaster {
  // Who is casting and where they are aiming.
  self(): CasterSelf;
  aimPoint(): { x: number; y: number };

  // Resource changes on the caster.
  heal(amount: number): void;
  restoreMana(amount: number): void;
  restoreStamina(amount: number): void;

  // Combat + movement.
  spawnProjectile(cfg: ProjectileSpawnConfig): void;
  dash(distance: number, direction: DashDirection, durationMs: number): void;
  applyInvuln(ms: number): void;

  // Feedback. flash tints the caster; castVisual plays the attribute-identity
  // effect on the skill area.
  flash(color: number, ms: number): void;
  castVisual(color: number, radius: number): void;

  // Optional advanced effects:
  spawnMeleeHitbox?(opts: {
    damage: number;
    range: number;
    arcDeg: number;
    hitCount: number;
    knockback: number;
  }): void;
  startAura?(aura: AuraSkillData, skillId: string, color: number): void;
  spawnSummon?(opts: {
    summonType: string;
    durationMs: number;
    maxActive: number;
    hp: number;
    atk: number;
  }): void;
  applyTimedSelfBuff?(mods: SkillStatMod[], durationMs: number): void;
  applyTimedBuff?(resource: string, durationMs: number): void;
  grantNextAttackBonus?(amount: number, durationMs: number): void;
}

export type { AttributeSet };
