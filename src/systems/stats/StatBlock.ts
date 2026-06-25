// StatBlock — the per-creature stat container and calculation pipeline.
//
// Pipeline (recompute):
//   1. base attributes + attribute modifiers      -> final attributes
//   2. final attributes -> derived main & sub stats (formulas.ts)
//   3. + innate flat base main/sub stats           (entity-specific)
//   4. + main/sub stat modifiers (flat then percent)
//   => final combat values
//
// Results are cached and only recomputed when something changes (dirty flag),
// so reading finished values every frame is cheap.
//
// Usable by players, enemies, bosses, and future NPCs — it knows nothing about
// any of them; it just holds numbers.

import {
  AttributeKey,
  AttributeSet,
  ATTRIBUTE_KEYS,
  MainStatKey,
  MainStatSet,
  MAIN_STAT_KEYS,
  SubStatKey,
  SubStatSet,
  SUB_STAT_KEYS,
  StatKey,
  fillAttributes,
  zeroMainStats,
  zeroSubStats,
} from "./types";
import { deriveMainStats, deriveSubStats } from "./formulas";
import { ModifierSource, StatModifier } from "./modifiers";

export interface StatBlockConfig {
  attributes?: Partial<AttributeSet>;
  // Innate flat main/sub values added on top of attribute-derived amounts.
  // Useful for entities that should have a baseline independent of attributes.
  baseMainStats?: Partial<MainStatSet>;
  baseSubStats?: Partial<SubStatSet>;
  // "derived" (default): main/sub come from attribute conversion plus the base
  // values above. "authored": the base values ARE the stats (no attribute
  // derivation); modifiers still apply. Enemies use authored mode so their
  // hand-tuned stat sheets are exact, while the player stays derived.
  mainStatMode?: "derived" | "authored";
  subStatMode?: "derived" | "authored";
}

export interface StatSnapshot {
  attributes: AttributeSet;
  main: MainStatSet;
  sub: SubStatSet;
}

export class StatBlock {
  private baseAttributes: AttributeSet;
  private baseMain: Partial<MainStatSet>;
  private baseSub: Partial<SubStatSet>;
  private mainMode: "derived" | "authored";
  private subMode: "derived" | "authored";
  private modifiers: StatModifier[] = [];

  private dirty = true;
  private finalAttributes: AttributeSet = fillAttributes();
  private finalMain: MainStatSet = zeroMainStats();
  private finalSub: SubStatSet = zeroSubStats();

  constructor(cfg: StatBlockConfig = {}) {
    this.baseAttributes = fillAttributes(cfg.attributes);
    this.baseMain = { ...(cfg.baseMainStats ?? {}) };
    this.baseSub = { ...(cfg.baseSubStats ?? {}) };
    this.mainMode = cfg.mainStatMode ?? "derived";
    this.subMode = cfg.subStatMode ?? "derived";
  }

  // ----- Base attribute editing (e.g. spending attribute points) -----

  setAttribute(key: AttributeKey, value: number): void {
    this.baseAttributes[key] = value;
    this.dirty = true;
  }

  addAttribute(key: AttributeKey, delta: number): void {
    this.baseAttributes[key] += delta;
    this.dirty = true;
  }

  getBaseAttributes(): AttributeSet {
    return { ...this.baseAttributes };
  }

  // ----- Modifier injection points -----

  addModifier(mod: StatModifier): void {
    this.modifiers.push(mod);
    this.dirty = true;
  }

  removeModifier(id: string): void {
    const before = this.modifiers.length;
    this.modifiers = this.modifiers.filter((m) => m.id !== id);
    if (this.modifiers.length !== before) this.dirty = true;
  }

  clearSource(source: ModifierSource): void {
    const before = this.modifiers.length;
    this.modifiers = this.modifiers.filter((m) => m.source !== source);
    if (this.modifiers.length !== before) this.dirty = true;
  }

  clearAllModifiers(): void {
    if (this.modifiers.length === 0) return;
    this.modifiers = [];
    this.dirty = true;
  }

  listModifiers(): readonly StatModifier[] {
    return this.modifiers;
  }

  // ----- Finished values -----

  getAttributes(): AttributeSet {
    this.recompute();
    return this.finalAttributes;
  }

  getMainStats(): MainStatSet {
    this.recompute();
    return this.finalMain;
  }

  getSubStats(): SubStatSet {
    this.recompute();
    return this.finalSub;
  }

  getMain(key: MainStatKey): number {
    this.recompute();
    return this.finalMain[key];
  }

  getSub(key: SubStatKey): number {
    this.recompute();
    return this.finalSub[key];
  }

  snapshot(): StatSnapshot {
    this.recompute();
    return {
      attributes: { ...this.finalAttributes },
      main: { ...this.finalMain },
      sub: { ...this.finalSub },
    };
  }

  // ----- Pipeline -----

  private recompute(): void {
    if (!this.dirty) return;

    const flat = new Map<StatKey, number>();
    const percent = new Map<StatKey, number>();
    for (const m of this.modifiers) {
      const bucket = m.op === "flat" ? flat : percent;
      bucket.set(m.stat, (bucket.get(m.stat) ?? 0) + m.value);
    }
    const applyMods = (key: StatKey, base: number): number =>
      (base + (flat.get(key) ?? 0)) * (1 + (percent.get(key) ?? 0) / 100);

    // 1. attributes
    const attrs = fillAttributes(this.baseAttributes);
    for (const a of ATTRIBUTE_KEYS) attrs[a] = applyMods(a, attrs[a]);
    this.finalAttributes = attrs;

    // 2/3. base main/sub: derived (attributes + innate base) or authored
    // (base values used verbatim).
    const main =
      this.mainMode === "authored" ? zeroMainStats() : deriveMainStats(attrs);
    const sub =
      this.subMode === "authored" ? zeroSubStats() : deriveSubStats(attrs);
    for (const k of MAIN_STAT_KEYS) main[k] += this.baseMain[k] ?? 0;
    for (const k of SUB_STAT_KEYS) sub[k] += this.baseSub[k] ?? 0;

    // 4. apply main/sub modifiers
    for (const k of MAIN_STAT_KEYS) main[k] = applyMods(k, main[k]);
    for (const k of SUB_STAT_KEYS) sub[k] = applyMods(k, sub[k]);

    this.finalMain = main;
    this.finalSub = sub;
    this.dirty = false;
  }

  // ----- Debugging -----

  debugString(): string {
    this.recompute();
    const round = (n: number) => Math.round(n * 100) / 100;
    const fmt = (o: Record<string, number>) =>
      Object.entries(o)
        .map(([k, v]) => `${k} ${round(v)}`)
        .join("  ");
    const lines = [
      "ATTR | " + fmt(this.finalAttributes),
      "MAIN | " + fmt(this.finalMain),
      "SUB  | " + fmt(this.finalSub),
    ];
    if (this.modifiers.length > 0) {
      const mods = this.modifiers
        .map((m) => `${m.source}:${m.stat}${m.op === "percent" ? "%" : ""}${m.value}`)
        .join(", ");
      lines.push("MODS | " + mods);
    }
    return lines.join("\n");
  }
}
