// Centralised attribute -> stat conversion.
//
// ALL balance coefficients live here. Gameplay code never hardcodes a
// conversion rate; it asks a StatBlock for a finished value. To rebalance,
// edit only this file.
//
// The mapping mirrors the design spec exactly:
//   VIT -> HP, DEF, TEN
//   MIG -> ATK, HP
//   AGI -> MS, AS, STA
//   INT -> MP, CDR, PEN
//   INS -> MP, CRR, CRD, LUC
//   PRE -> GEN, AMP, LS
//
// Coefficients below are provisional placeholders. They are intentionally
// NOT used to drive current gameplay numbers yet (see milestone note: do not
// rebalance). They exist so the pipeline produces meaningful debug output and
// is ready to take over combat math later.

import {
  ATTRIBUTE_KEYS,
  AttributeKey,
  AttributeSet,
  MAIN_STAT_KEYS,
  MainStatKey,
  MainStatSet,
  SUB_STAT_KEYS,
  SubStatKey,
  SubStatSet,
  makeRecord,
} from "./types";

// Physical attributes -> Main Stats (and the main-stat portion of mental
// attributes). Each number is "main-stat units gained per attribute point".
export const ATTRIBUTE_TO_MAIN: Record<
  AttributeKey,
  Partial<Record<MainStatKey, number>>
> = {
  VIT: { HP: 8, DEF: 1.5, TEN: 1 },
  MIG: { ATK: 2, HP: 4 },
  AGI: { MS: 0.5, AS: 0.4, STA: 3 },
  INT: { MP: 6 },
  INS: { MP: 6 },
  PRE: {},
};

// Mental attributes -> Signature Sub Stats. This is what gives mental builds a
// distinct identity rather than being weaker physical builds.
export const ATTRIBUTE_TO_SUB: Record<
  AttributeKey,
  Partial<Record<SubStatKey, number>>
> = {
  VIT: {},
  MIG: {},
  AGI: {},
  INT: { CDR: 0.4, PEN: 0.5 },
  INS: { CRR: 0.3, CRD: 0.5, LUC: 0.2 },
  PRE: { GEN: 1, AMP: 0.5, LS: 0.3 },
};

// Legacy linear tables kept for reference but no longer used in the live
// pipeline — computeStatsAtLevel is the authoritative formula.
export function deriveMainStats(attrs: AttributeSet): MainStatSet {
  const out = makeRecord(MAIN_STAT_KEYS);
  for (const a of ATTRIBUTE_KEYS) {
    const contrib = ATTRIBUTE_TO_MAIN[a];
    for (const m of MAIN_STAT_KEYS) {
      out[m] += attrs[a] * (contrib[m] ?? 0);
    }
  }
  return out;
}

export function deriveSubStats(attrs: AttributeSet): SubStatSet {
  const out = makeRecord(SUB_STAT_KEYS);
  for (const a of ATTRIBUTE_KEYS) {
    const contrib = ATTRIBUTE_TO_SUB[a];
    for (const s of SUB_STAT_KEYS) {
      out[s] += attrs[a] * (contrib[s] ?? 0);
    }
  }
  return out;
}

// Full-set wrappers used by the StatBlock derived pipeline. These call
// computeStatsAtLevel so the live stat system and the enemy pre-bake are
// driven by exactly one formula.
export function computeDerivedMain(attrs: AttributeSet, level: number): MainStatSet {
  const { main } = computeStatsAtLevel(attrs, level);
  const out = makeRecord(MAIN_STAT_KEYS);
  for (const k of MAIN_STAT_KEYS) out[k] = main[k] ?? 0;
  return out;
}

export function computeDerivedSub(attrs: AttributeSet, level: number): SubStatSet {
  const { sub } = computeStatsAtLevel(attrs, level);
  const out = makeRecord(SUB_STAT_KEYS);
  for (const k of SUB_STAT_KEYS) out[k] = sub[k] ?? 0;
  return out;
}

// Per-attribute spec applied at a given character level. Returns finished
// main/sub stat sheets ready to be authored into an Enemy.
//
// Bases at level L:
//   HP  = (100 + 10*L) × (1 + 0.02×VIT)
//   MP  = (100 +  5*L) × (1 + 0.03×INT + 0.05×INS + 0.01×PRE)
//   STA = (100 +  5*L) × (1 + 0.05×MIG + 0.05×AGI + 0.01×PRE)
//   ATK = (10 + 0.1*L) + 3×MIG + 2×INT + 1×PRE
//   DEF = (10 + 0.1*L) + 3×VIT + 1×PRE
//   MS  = 0.01×AGI          (unit: see MS_TO_PX in Enemy.ts)
//   AS  = 7 + 0.05×AGI
//   TEN = 0.3×VIT
export function computeStatsAtLevel(
  attrs: Partial<AttributeSet>,
  level: number,
): { main: Partial<MainStatSet>; sub: Partial<SubStatSet> } {
  const a = { ...zeroAttributesLocal(), ...(attrs ?? {}) };

  const hpBase  = 100 + 10 * level;
  const mpBase  = 100 +  5 * level;
  const staBase = 100 +  5 * level;
  const atkBase = 10 + 0.1 * level;
  const defBase = 10 + 0.1 * level;

  const round = (n: number) => Math.round(n * 100) / 100;

  const main: Partial<MainStatSet> = {
    HP:  round(hpBase  * (1 + 0.02 * a.VIT)),
    MP:  round(mpBase  * (1 + 0.03 * a.INT + 0.05 * a.INS + 0.01 * a.PRE)),
    STA: round(staBase * (1 + 0.05 * a.MIG + 0.05 * a.AGI + 0.01 * a.PRE)),
    ATK: round(atkBase + 3 * a.MIG + 2 * a.INT + 1 * a.PRE),
    DEF: round(defBase + 3 * a.VIT + 1 * a.PRE),
    MS:  round(0.01 * a.AGI),
    AS:  round(7 + 0.05 * a.AGI),
    TEN: round(0.3 * a.VIT),
  };

  const sub: Partial<SubStatSet> = {
    GEN: round(0.05 * a.INT + 0.05 * a.INS + 0.01 * a.PRE),
    CRR: 0,
    CRD: 1.4, // documented default x1.4
    CDR: 0,
    PEN: 0,
    AMP: round(0.05 * a.INT + 0.10 * a.INS),
    LS: round(0.01 * a.PRE),
    LUC: round(0.1 * a.PRE),
  };

  return { main, sub };
}

function zeroAttributesLocal(): AttributeSet {
  return { VIT: 0, MIG: 0, AGI: 0, INT: 0, INS: 0, PRE: 0 };
}
