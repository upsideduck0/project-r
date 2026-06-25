// Skill executor. Dispatches purely on which Type Data blocks a skill carries,
// so hundreds of skills can be added as data with zero special-case code here.
//
// Each block is independent and additive: a skill that has both `aura` and
// `buff` runs both. This is how composite skills (e.g. Holy Nova = Heal +
// Aura, or Battle Rush = Movement + Buff) work without bespoke logic.
//
// The executor is actor-agnostic: it drives the generic SkillCaster, so the
// same skill definitions are cast by the player, enemies, bosses, and summons.

import { ATTRIBUTE_KEYS, AttributeKey } from "../../systems/stats/types";
import { ATTRIBUTE_COLORS } from "../attributes/colors";
import { computeFinalDamage, DamageContext } from "./formulas";
import {
  AuraSkillData,
  BuffSkillData,
  DashSkillData,
  MeleeSkillData,
  ProjectileSkillData,
  SkillCaster,
  SkillDef,
  SummonSkillData,
} from "./types";

export interface SkillRuntimeContext {
  // Caster's damage context (attributes / atk / amp). Defaults to neutral,
  // which keeps base values unchanged.
  damage?: DamageContext;
}

// The attribute whose color represents this skill: explicit dominant if set,
// otherwise the highest scaling coefficient.
export function dominantAttribute(skill: SkillDef): AttributeKey {
  if (skill.core.dominantAttribute) return skill.core.dominantAttribute;
  let best: AttributeKey = "MIG";
  let bestVal = -Infinity;
  for (const k of ATTRIBUTE_KEYS) {
    const v = skill.scaling[k] ?? 0;
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  }
  return best;
}

export function executeSkill(
  skill: SkillDef,
  caster: SkillCaster,
  ctx: SkillRuntimeContext = {},
): void {
  const dmgCtx = ctx.damage ?? {};

  // Attribute-identity cast visual, sized to the skill's footprint.
  const color = ATTRIBUTE_COLORS[dominantAttribute(skill)];
  caster.castVisual(color, castRadius(skill));

  if (skill.projectile) runProjectile(skill, skill.projectile, caster, dmgCtx);
  if (skill.melee) runMelee(skill, skill.melee, caster, dmgCtx);
  if (skill.dash) runDash(skill.dash, caster);
  if (skill.aura) runAura(skill.aura, skill.core.id, color, caster);
  if (skill.summon) runSummon(skill.summon, caster);
  if (skill.buff) runBuff(skill.buff, caster);
  // Debuffs target enemies; needs a targeting hook that doesn't exist yet, so
  // it is intentionally a no-op until that injection point is added.
}

function castRadius(skill: SkillDef): number {
  if (skill.aura) return skill.aura.radius;
  if (skill.melee) return skill.melee.range;
  if (skill.dash) return 34;
  return 26;
}

function aimDir(caster: SkillCaster): { dx: number; dy: number } {
  const s = caster.self();
  const t = caster.aimPoint();
  let dx = t.x - s.x;
  let dy = t.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return { dx: s.facing, dy: 0 };
  return { dx: dx / len, dy: dy / len };
}

function runProjectile(
  skill: SkillDef,
  data: ProjectileSkillData,
  caster: SkillCaster,
  dmgCtx: DamageContext,
): void {
  const s = caster.self();
  const { dx, dy } = aimDir(caster);
  const damage = computeFinalDamage(data.baseDamage, skill.scaling, dmgCtx);
  const range = Math.round((data.speed * data.lifetimeMs) / 1000);
  const count = Math.max(1, data.count);
  const spread = ((data.spreadDeg ?? 0) * Math.PI) / 180;
  const baseAngle = Math.atan2(dy, dx);

  for (let i = 0; i < count; i++) {
    // Fan shots evenly across the spread, centered on the aim direction.
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
    const angle = baseAngle + offset;
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    caster.spawnProjectile({
      x: s.x + s.facing * 6,
      y: s.y,
      vx: ax * data.speed,
      vy: ay * data.speed,
      damage,
      texture: data.texture ?? "proj-fireball",
      range,
      rotation: angle,
      knockX: data.knockX ?? 0,
      knockY: data.knockY ?? 0,
      homingTurnRate: data.homing,
      gravityAfterMs: 0,
      piercing: data.pierce > 0,
      glowTint: data.glowTint ?? 0,
      glowFrequencyMs: data.glowFrequencyMs ?? 0,
      glowLifespanMs: data.glowLifespanMs ?? 0,
    });
  }
}

function runMelee(
  skill: SkillDef,
  data: MeleeSkillData,
  caster: SkillCaster,
  dmgCtx: DamageContext,
): void {
  if (!caster.spawnMeleeHitbox) return;
  caster.spawnMeleeHitbox({
    damage: computeFinalDamage(data.baseDamage, skill.scaling, dmgCtx),
    range: data.range,
    arcDeg: data.swingArcDeg,
    hitCount: data.hitCount,
    knockback: data.knockback,
  });
}

function runDash(data: DashSkillData, caster: SkillCaster): void {
  caster.dash(data.distance, data.direction ?? "facing", data.durationMs);
  if (data.invulnMs > 0) caster.applyInvuln(data.invulnMs);
  if (data.flashColor !== undefined) caster.flash(data.flashColor, 180);
}

function runAura(
  data: AuraSkillData,
  skillId: string,
  color: number,
  caster: SkillCaster,
): void {
  caster.startAura?.(data, skillId, color);
}

function runSummon(data: SummonSkillData, caster: SkillCaster): void {
  if (!caster.spawnSummon) return;
  caster.spawnSummon({
    summonType: data.summonType,
    durationMs: data.durationMs,
    maxActive: data.maxActive,
    hp: data.summonHp,
    atk: data.summonAtk,
  });
}

function runBuff(data: BuffSkillData, caster: SkillCaster): void {
  // Instant resource change (heal / mana / stamina restore).
  if (data.resource && data.durationMs === 0) {
    if (data.resource === "hp") caster.heal(data.effectStrength);
    else if (data.resource === "mp") caster.restoreMana(data.effectStrength);
    else if (data.resource === "sta") caster.restoreStamina(data.effectStrength);
  }
  // Timed custom resource buff (focus, nimble, etc.).
  if (data.resource && data.durationMs > 0 && caster.applyTimedBuff) {
    caster.applyTimedBuff(data.resource, data.durationMs);
  }
  // Timed stat modifiers (optional hook).
  if (data.statMods && data.durationMs > 0 && caster.applyTimedSelfBuff) {
    caster.applyTimedSelfBuff(data.statMods, data.durationMs);
  }
  // Empower next attack (e.g. Battle Rush).
  if (data.nextAttackBonus && caster.grantNextAttackBonus) {
    caster.grantNextAttackBonus(data.nextAttackBonus, data.durationMs);
  }
  if (data.flashColor !== undefined) caster.flash(data.flashColor, 200);
}
