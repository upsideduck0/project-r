// Centralized skill math. Skill power and character power are kept separate:
// the skill provides a base value, the character context modifies the final
// result. Balancing lives here only.
//
// NOTE: callers currently pass a neutral DamageContext (no attributes / atk /
// amp), so computeFinalDamage returns the skill's base value unchanged — the
// formula is wired and ready but does not rebalance existing skills yet. Feed
// it a real character context (player StatBlock) to switch scaling on.

import { ATTRIBUTE_KEYS, AttributeKey, AttributeSet } from "../../systems/stats/types";
import { AttributeRequirements, AttributeScaling } from "./types";

export interface DamageContext {
  // Caster attributes, used together with a skill's scaling coefficients.
  attributes?: Partial<AttributeSet>;
  // Flat ATK main stat (additive).
  atk?: number;
  // AMP sub stat as a percent (multiplicative): 25 => +25%.
  amp?: number;
}

export function computeFinalDamage(
  base: number,
  scaling: AttributeScaling,
  ctx: DamageContext = {},
): number {
  let dmg = base;

  if (ctx.attributes) {
    for (const k of ATTRIBUTE_KEYS) {
      const coeff = scaling[k];
      if (coeff) dmg += coeff * (ctx.attributes[k] ?? 0);
    }
  }

  dmg += ctx.atk ?? 0;
  dmg *= 1 + (ctx.amp ?? 0) / 100;

  return Math.round(dmg);
}

export function missingRequirements(
  req: AttributeRequirements,
  attrs: Partial<AttributeSet>,
): AttributeKey[] {
  const missing: AttributeKey[] = [];
  for (const k of ATTRIBUTE_KEYS) {
    const need = req[k];
    if (need !== undefined && (attrs[k] ?? 0) < need) missing.push(k);
  }
  return missing;
}

export function meetsRequirements(
  req: AttributeRequirements,
  attrs: Partial<AttributeSet>,
): boolean {
  return missingRequirements(req, attrs).length === 0;
}
