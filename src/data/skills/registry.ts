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

  // ----- Enemy skills (reusable by any caster) -----

  battle_rush: {
    core: {
      id: "battle_rush",
      name: "Battle Rush",
      description: "Charge forward and empower the next attack.",
      icon: "skill-surge",
      rarity: "common",
      manaCost: 10,
      cooldownMs: 4000,
      castTimeMs: 0,
      requirements: {},
      tags: ["movement", "buff"],
      dominantAttribute: "MIG",
      complexity: 1,
    },
    scaling: { MIG: 1.2, AGI: 0.5 },
    dash: { distance: 150, durationMs: 400, invulnMs: 0, direction: "toward_target" },
    buff: { durationMs: 3000, effectStrength: 12, nextAttackBonus: 12 },
  },

  shadowstep: {
    core: {
      id: "shadowstep",
      name: "Shadowstep",
      description: "Teleport away from danger.",
      icon: "skill-blink",
      rarity: "common",
      manaCost: 20,
      cooldownMs: 5000,
      castTimeMs: 0,
      requirements: {},
      tags: ["movement"],
      dominantAttribute: "AGI",
      complexity: 1,
    },
    scaling: { AGI: 1.0 },
    dash: {
      distance: 120,
      durationMs: 0,
      invulnMs: 200,
      direction: "away_from_target",
      flashColor: 0xf4d35e,
    },
  },

  protect: {
    core: {
      id: "protect",
      name: "Protect",
      description: "Leap to an ally and reinforce them.",
      icon: "skill-heal",
      rarity: "uncommon",
      manaCost: 10,
      cooldownMs: 8000,
      castTimeMs: 500,
      requirements: {},
      tags: ["movement", "buff"],
      dominantAttribute: "VIT",
      complexity: 2,
    },
    scaling: { VIT: 1.0, MIG: 0.3, PRE: 0.2 },
    dash: { distance: 400, durationMs: 0, invulnMs: 0, direction: "to_nearest_ally" },
    // Self DEF bonus (buff) + ally DEF bonus in radius (aura).
    buff: { durationMs: 5000, effectStrength: 15, statMods: [{ stat: "DEF", op: "flat", value: 15 }] },
    aura: {
      radius: 120,
      tickRateMs: 500,
      durationMs: 5000,
      kindEffects: { "*": [{ stat: "DEF", op: "flat", value: 15 }] },
    },
  },

  mana_release: {
    core: {
      id: "mana_release",
      name: "Mana Release",
      description: "Release a volley of magical orbs.",
      icon: "skill-fireball",
      rarity: "uncommon",
      manaCost: 40,
      cooldownMs: 8000,
      castTimeMs: 1000,
      requirements: {},
      tags: ["projectile"],
      dominantAttribute: "INT",
      complexity: 2,
    },
    scaling: { INT: 1.2, INS: 0.5 },
    projectile: {
      baseDamage: 8,
      count: 5,
      speed: 150,
      lifetimeMs: 5000,
      pierce: 0,
      bounce: 0,
      homing: 0.2,
      texture: "proj-enemy-shot",
      spreadDeg: 70,
      knockX: 60,
      knockY: -40,
      glowTint: 0xff6f7a,
      glowFrequencyMs: 22,
      glowLifespanMs: 280,
    },
  },

  command_aura: {
    core: {
      id: "command_aura",
      name: "Command Aura",
      description: "Strengthens nearby allies.",
      icon: "skill-heal",
      rarity: "rare",
      manaCost: 0,
      cooldownMs: 0,
      castTimeMs: 0,
      requirements: {},
      tags: ["aura"],
      dominantAttribute: "PRE",
      complexity: 2,
    },
    scaling: { INT: 0.3, INS: 0.3, PRE: 1.5 },
    aura: {
      radius: 250,
      tickRateMs: 250,
      durationMs: -1, // infinite (passive)
      kindEffects: {
        tank: [{ stat: "DEF", op: "flat", value: 20 }],
        fighter: [{ stat: "AS", op: "percent", value: 50 }],
        thief: [{ stat: "MS", op: "percent", value: 50 }],
      },
    },
  },

  reinforcements: {
    core: {
      id: "reinforcements",
      name: "Reinforcements",
      description: "Call additional troops.",
      icon: "skill-surge",
      rarity: "rare",
      manaCost: 100,
      cooldownMs: 15000,
      castTimeMs: 2000,
      requirements: {},
      tags: ["summon", "movement"],
      dominantAttribute: "PRE",
      complexity: 3,
    },
    scaling: { INT: 0.5, INS: 0.5, PRE: 1.5 },
    dash: {
      distance: 600,
      durationMs: 0,
      invulnMs: 0,
      direction: "to_furthest_platform",
    },
    summon: {
      summonType: "fighter",
      durationMs: -1,
      maxActive: 1,
      summonHp: 100,
      summonAtk: 18,
    },
  },
};
