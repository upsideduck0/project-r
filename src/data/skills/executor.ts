// Skill executor. Dispatches purely on which Type Data blocks a skill carries,
// so hundreds of skills can be added as data with zero special-case code here.
//
// Each block is independent and additive: a skill that has both `aura` and
// `buff` runs both. This is how composite skills (e.g. Holy Nova = Heal +
// Aura) work without bespoke logic.

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

export function executeSkill(
  skill: SkillDef,
  caster: SkillCaster,
  ctx: SkillRuntimeContext = {},
): void {
  const dmgCtx = ctx.damage ?? {};
  if (skill.projectile) runProjectile(skill, skill.projectile, caster, dmgCtx);
  if (skill.melee) runMelee(skill, skill.melee, caster, dmgCtx);
  if (skill.dash) runDash(skill.dash, caster);
  if (skill.aura) runAura(skill, skill.aura, caster, dmgCtx);
  if (skill.summon) runSummon(skill.summon, caster);
  if (skill.buff) runBuff(skill.buff, caster);
  // Debuffs target enemies; needs a targeting hook that doesn't exist yet, so
  // it is intentionally a no-op until that injection point is added.
}

function aimFromCaster(caster: SkillCaster): { dx: number; dy: number } {
  const p = caster.player();
  const t = caster.cursor();
  let dx = t.x - p.x;
  let dy = t.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return { dx: p.facing, dy: 0 };
  return { dx: dx / len, dy: dy / len };
}

function runProjectile(
  skill: SkillDef,
  data: ProjectileSkillData,
  caster: SkillCaster,
  dmgCtx: DamageContext,
): void {
  const p = caster.player();
  const { dx, dy } = aimFromCaster(caster);
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
    caster.spawnPlayerProjectile({
      x: p.x + p.facing * 6,
      y: p.y,
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
  caster.blinkPlayer(data.distance);
  if (data.invulnMs > 0) caster.applyInvulnFor(data.invulnMs);
  if (data.flashColor !== undefined) caster.flashPlayer(data.flashColor, 180);
}

function runAura(
  skill: SkillDef,
  data: AuraSkillData,
  caster: SkillCaster,
  dmgCtx: DamageContext,
): void {
  if (!caster.spawnAura) return;
  caster.spawnAura({
    radius: data.radius,
    tickRateMs: data.tickRateMs,
    durationMs: data.durationMs,
    damage: data.baseDamage
      ? computeFinalDamage(data.baseDamage, skill.scaling, dmgCtx)
      : 0,
    heal: data.baseHeal ?? 0,
  });
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
    if (data.resource === "hp") caster.healPlayer(data.effectStrength);
    else if (data.resource === "mp") caster.restoreMana(data.effectStrength);
    else if (data.resource === "sta") caster.restoreStamina(data.effectStrength);
  }
  // Timed stat modifiers (optional hook).
  if (data.statMods && data.durationMs > 0 && caster.applyTimedSelfBuff) {
    caster.applyTimedSelfBuff(data.statMods, data.durationMs);
  }
  if (data.flashColor !== undefined) caster.flashPlayer(data.flashColor, 200);
}
