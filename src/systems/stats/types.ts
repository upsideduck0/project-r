// Core stat vocabulary for the character framework.
//
// Three layers:
//   Attributes  — the six identity values players invest into.
//   Main Stats  — universal combat values derived from attributes.
//   Sub Stats   — specialised values from gear / buffs / passives etc.
//
// Everything here is pure data + tiny helpers. Conversion lives in
// formulas.ts; assembly + modifier application lives in StatBlock.ts.

export const ATTRIBUTE_KEYS = ["VIT", "MIG", "AGI", "INT", "INS", "PRE"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type AttributeSet = Record<AttributeKey, number>;

export const ATTRIBUTE_NAMES: Record<AttributeKey, string> = {
  VIT: "Vitality",
  MIG: "Might",
  AGI: "Agility",
  INT: "Intellect",
  INS: "Insight",
  PRE: "Presence",
};

export const MAIN_STAT_KEYS = [
  "HP",
  "MP",
  "STA",
  "ATK",
  "DEF",
  "MS",
  "AS",
  "TEN",
] as const;
export type MainStatKey = (typeof MAIN_STAT_KEYS)[number];
export type MainStatSet = Record<MainStatKey, number>;

export const MAIN_STAT_NAMES: Record<MainStatKey, string> = {
  HP: "Health",
  MP: "Mana",
  STA: "Stamina",
  ATK: "Damage",
  DEF: "Defense",
  MS: "Movement Speed",
  AS: "Attack Speed",
  TEN: "Tenacity",
};

export const SUB_STAT_KEYS = [
  "GEN",
  "CRR",
  "CRD",
  "CDR",
  "PEN",
  "AMP",
  "LS",
  "LUC",
] as const;
export type SubStatKey = (typeof SUB_STAT_KEYS)[number];
export type SubStatSet = Record<SubStatKey, number>;

export const SUB_STAT_NAMES: Record<SubStatKey, string> = {
  GEN: "Resource Generation",
  CRR: "Critical Rate",
  CRD: "Critical Damage",
  CDR: "Cooldown Reduction",
  PEN: "Defense Penetration",
  AMP: "Ability Amplification",
  LS: "Life Steal",
  LUC: "Luck",
};

// Any single stat key, across all three layers. Modifiers can target any of
// these.
export type StatKey = AttributeKey | MainStatKey | SubStatKey;

export function makeRecord<K extends string>(
  keys: readonly K[],
  value = 0,
): Record<K, number> {
  const r = {} as Record<K, number>;
  for (const k of keys) r[k] = value;
  return r;
}

export function zeroAttributes(): AttributeSet {
  return makeRecord(ATTRIBUTE_KEYS);
}

export function zeroMainStats(): MainStatSet {
  return makeRecord(MAIN_STAT_KEYS);
}

export function zeroSubStats(): SubStatSet {
  return makeRecord(SUB_STAT_KEYS);
}

export function fillAttributes(partial?: Partial<AttributeSet>): AttributeSet {
  return { ...zeroAttributes(), ...(partial ?? {}) };
}
