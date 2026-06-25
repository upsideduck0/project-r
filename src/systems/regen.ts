// Centralized resource regeneration. Shared by players, enemies, summons,
// future NPCs / bosses — anything that holds the three core resources and a
// GEN sub stat.
//
// Rule per the spec:
//   +1.0 HP per second  per 1 GEN
//   +0.5 MP per second  per 1 GEN
//   +0.5 STA per second per 1 GEN

export interface Vitals {
  hp: number;
  mp: number;
  sta: number;
}

export interface VitalCaps {
  hp: number;
  mp: number;
  sta: number;
}

export const HP_PER_GEN_PER_SEC = 1.0;
export const MP_PER_GEN_PER_SEC = 0.5;
export const STA_PER_GEN_PER_SEC = 0.5;

export function applyRegen(
  vitals: Vitals,
  caps: VitalCaps,
  gen: number,
  dtSeconds: number,
): void {
  if (gen <= 0 || dtSeconds <= 0) return;
  vitals.hp = Math.min(caps.hp, vitals.hp + HP_PER_GEN_PER_SEC * gen * dtSeconds);
  vitals.mp = Math.min(caps.mp, vitals.mp + MP_PER_GEN_PER_SEC * gen * dtSeconds);
  vitals.sta = Math.min(caps.sta, vitals.sta + STA_PER_GEN_PER_SEC * gen * dtSeconds);
}
