// Shared combat math used for non-weapon ("tackle") body contact.
//
// Rule: weapons are the primary damage source. Bumping into someone only
// hurts when there's a meaningful VIT mismatch and the victim's DEF can't
// soak it.
//
//   base = |attackerVIT - victimVIT|
//   if base > victimDEF: damage = base - victimDEF
//   else:                damage = 0
export function tackleDamage(
  attackerVIT: number,
  victimVIT: number,
  victimDEF: number,
): number {
  const base = Math.abs(attackerVIT - victimVIT);
  if (base <= victimDEF) return 0;
  return Math.round(base - victimDEF);
}

// Weapon/projectile damage mitigation.
//
// Uses percentage reduction so DEF never reduces damage to 0:
//   finalDamage = max(1, round(raw * 100 / (100 + def)))
//
// At DEF=0 the attacker deals full damage; at DEF=100 they deal half.
export function mitigateDamage(raw: number, def: number): number {
  return Math.max(1, Math.round((raw * 100) / (100 + def)));
}
