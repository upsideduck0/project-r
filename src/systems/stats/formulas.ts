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
