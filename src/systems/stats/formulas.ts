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

// New per-attribute spec applied at a given character level. Returns finished
// main/sub stat sheets ready to be authored into an Enemy.
//
// Bases at level L:
//   HP  = 100 + 10*L
//   ATK = 10 + 0.1*L
//   DEF = 10 + 0.1*L
//   AS  = 7
//   TEN = 0
//   MP/STA/MS have no documented base → 0 (per "stats unable to calculate
//   can be set to 0").
//
// HP/MP/STA are multiplier-based; everything else is additive.
export function computeStatsAtLevel(
  attrs: Partial<AttributeSet>,
  level: number,
): { main: Partial<MainStatSet>; sub: Partial<SubStatSet> } {
  const a = { ...zeroAttributesLocal(), ...(attrs ?? {}) };

  const hpBase = 100 + 10 * level;
  const atkBase = 10 + 0.1 * level;
  const defBase = 10 + 0.1 * level;

  const hpMult = 1 + 0.01 * a.VIT;
  // MP and STA bases are undocumented; multiplying 0 leaves them at 0.

  const round = (n: number) => Math.round(n * 100) / 100;

  const main: Partial<MainStatSet> = {
    HP: round(hpBase * hpMult),
    MP: 0,
    STA: 0,
    ATK: round(atkBase + 3 * a.MIG + 2 * a.INT + 1 * a.PRE),
    DEF: round(defBase + 3 * a.VIT + 1 * a.PRE),
    MS: round(0.005 * a.AGI),
    AS: round(7 + 0.05 * a.AGI),
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
