// Skill registry. Each entry is pure data across the three layers; behaviour
// comes from executor.ts reading the Type Data blocks.
//
// Values below reproduce the previous skills exactly (no rebalance):
//   fireball  dmg 26, speed 480, range ~520, knock 160/-90, orange glow
//   heal      +40 HP
//   surge     +60 STA
//   blink     140px, 220ms invuln

import { SkillDef } from "./types";

export const SKILLS: Record<string, SkillDef> = {
  fireball: {
    core: {
      id: "fireball",
      name: "Fireball",
      description: "Hurl a bolt of flame toward the cursor.",
      icon: "skill-fireball",
      rarity: "common",
      manaCost: 12,
      cooldownMs: 600,
      castTimeMs: 0,
      requirements: { INT: 10 },
      tags: ["projectile"],
      complexity: 1,
    },
    scaling: { INT: 1.2, INS: 0.5 },
    projectile: {
      baseDamage: 26,
      count: 1,
      speed: 480,
      lifetimeMs: 1083, // speed * lifetime / 1000 ≈ 520px range
      pierce: 0,
      bounce: 0,
      homing: 0,
      texture: "proj-fireball",
      knockX: 160,
      knockY: -90,
      glowTint: 0xff8030,
      glowFrequencyMs: 16,
      glowLifespanMs: 360,
    },
  },

  heal: {
    core: {
      id: "heal",
      name: "Heal",
      description: "Restore a burst of health.",
      icon: "skill-heal",
      rarity: "common",
      manaCost: 18,
      cooldownMs: 4000,
      castTimeMs: 0,
      requirements: {},
      tags: ["heal"],
      complexity: 1,
    },
    scaling: { PRE: 1.0, INS: 0.8 },
    buff: {
      durationMs: 0,
      effectStrength: 40,
      resource: "hp",
      flashColor: 0x60d060,
    },
  },

  surge: {
    core: {
      id: "surge",
      name: "Stamina Surge",
      description: "Instantly recover stamina.",
      icon: "skill-surge",
      rarity: "common",
      manaCost: 10,
      cooldownMs: 5000,
      castTimeMs: 0,
      requirements: {},
      tags: ["buff"],
      complexity: 1,
    },
    scaling: { AGI: 0.6 },
    buff: {
      durationMs: 0,
      effectStrength: 60,
      resource: "sta",
      flashColor: 0xf4d35e,
    },
  },

  blink: {
    core: {
      id: "blink",
      name: "Blink",
      description: "Dash forward, briefly invulnerable.",
      icon: "skill-blink",
      rarity: "uncommon",
      manaCost: 14,
      cooldownMs: 2000,
      castTimeMs: 0,
      requirements: { AGI: 10 },
      tags: ["movement"],
      complexity: 2,
    },
    scaling: { AGI: 0.5 },
    dash: {
      distance: 140,
      durationMs: 0,
      invulnMs: 220,
      flashColor: 0x6fd3ff,
    },
  },
};
