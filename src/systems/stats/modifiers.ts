// Modifier layer. This is the single, explicit injection point for every
// future system that wants to change a creature's stats.
//
// A StatModifier targets ANY stat key (attribute, main, or sub) and applies
// either a flat addition or a percent addition. Modifiers are tagged with a
// source so an entire system's contribution can be wiped in one call (e.g.
// remove all "buff" modifiers when a buff expires).

import { StatKey } from "./types";

// Where a modifier comes from. New systems plug in by using one of these
// source tags — no StatBlock changes required.
export const MODIFIER_SOURCES = [
  "equipment", // gear slots
  "buff", // positive temporary effects
  "debuff", // negative temporary effects
  "passive", // always-on traits
  "class", // class / archetype bonuses
  "temporary", // misc short-lived effects (dev tools, scripted events)
] as const;
export type ModifierSource = (typeof MODIFIER_SOURCES)[number];

// "flat" adds raw units. "percent" adds a percentage of the post-flat value,
// where value is a whole number (25 => +25%). Percents from multiple sources
// are summed (additive), which is predictable and easy to reason about.
export type ModifierOp = "flat" | "percent";

export interface StatModifier {
  // Unique within the block, so it can be removed individually.
  id: string;
  source: ModifierSource;
  stat: StatKey;
  op: ModifierOp;
  value: number;
}

let autoId = 0;

export function makeModifier(
  source: ModifierSource,
  stat: StatKey,
  op: ModifierOp,
  value: number,
  id?: string,
): StatModifier {
  return { id: id ?? `${source}-${stat}-${++autoId}`, source, stat, op, value };
}
