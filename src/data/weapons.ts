import Phaser from "phaser";
import type { AttributeKey } from "../systems/stats/types";

export type WeaponType = "melee" | "ranged" | "magic";
export type WeaponRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

// A single passive / on-hit / on-kill / aura effect attached to a weapon.
// Effects are intentionally free-form strings + numeric params right now;
// runtime systems pick the ones they understand. Future work fleshes these out.
export interface WeaponEffect {
  id: string;
  description?: string;
  value?: number;
}

// The five-section weapon spec.
//
//   Identity         — id, name, description, rarity, type
//   Requirements     — minimum attribute investment to wield effectively
//   Combat Stats     — baseDamage, attack speed mod, range, knockback, costs
//   Scaling          — per-attribute coefficients added to base damage
//   Special          — passive/on-hit/on-kill/aura effect lists
//
// The flat melee/projectile fields below are implementation details consumed
// by GameScene to spawn the actual hitbox / projectile.
export interface WeaponDef {
  // ----- Identity -----
  id: string;
  name: string;
  description: string;
  rarity: WeaponRarity;
  type: WeaponType;

  // ----- Requirements -----
  requirements: Partial<Record<AttributeKey, number>>;

  // ----- Combat Stats -----
  baseDamage: number;
  attackSpeedMod: number; // multiplier on cooldown; 1.0 = nominal
  range: number;
  knockback: { x: number; y: number };
  staminaCost: number;
  manaCost: number;

  // ----- Scaling -----
  scaling: Partial<Record<AttributeKey, number>>;

  // ----- Special Properties -----
  passive: WeaponEffect[];
  onHit: WeaponEffect[];
  onKill: WeaponEffect[];
  aura: WeaponEffect[];

  // ----- Visual / runtime details -----
  heldTexture: string;
  cooldownMs: number;

  // Melee runtime (used when type === "melee")
  swingHeight: number;
  swingDurationMs: number;

  // Projectile runtime (used when type !== "melee")
  projectileSpeed: number;
  projectileTexture: string;
  projectileGravityAfterMs: number;
  piercing: boolean;
  homingTurnRate: number;
  glowTint: number;
  glowFrequencyMs: number;
  glowLifespanMs: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  wooden_sword: {
    id: "wooden_sword",
    name: "Wooden Sword",
    description: "A simple training sword.",
    rarity: "common",
    type: "melee",
    requirements: { MIG: 4 },
    baseDamage: 14,
    attackSpeedMod: 1.0,
    range: 72,
    knockback: { x: 280, y: -180 },
    staminaCost: 8,
    manaCost: 0,
    scaling: { MIG: 0.8, VIT: 0.2 },
    passive: [],
    onHit: [],
    onKill: [],
    aura: [],
    heldTexture: "wpn-wooden-sword",
    cooldownMs: 320,
    swingHeight: 48,
    swingDurationMs: 180,
    projectileSpeed: 0,
    projectileTexture: "",
    projectileGravityAfterMs: 0,
    piercing: false,
    homingTurnRate: 0,
    glowTint: 0,
    glowFrequencyMs: 0,
    glowLifespanMs: 0,
  },
  wooden_bow: {
    id: "wooden_bow",
    name: "Wooden Bow",
    description: "A simple shortbow.",
    rarity: "common",
    type: "ranged",
    requirements: { AGI: 6 },
    baseDamage: 10,
    attackSpeedMod: 1.0,
    range: 720,
    knockback: { x: 110, y: -40 },
    staminaCost: 10,
    manaCost: 0,
    scaling: { AGI: 0.7, MIG: 0.3 },
    passive: [],
    onHit: [],
    onKill: [],
    aura: [],
    heldTexture: "wpn-wooden-bow",
    cooldownMs: 380,
    swingHeight: 0,
    swingDurationMs: 0,
    projectileSpeed: 560,
    projectileTexture: "proj-arrow",
    projectileGravityAfterMs: 280,
    piercing: false,
    homingTurnRate: 0,
    glowTint: 0,
    glowFrequencyMs: 0,
    glowLifespanMs: 0,
  },
  wooden_staff: {
    id: "wooden_staff",
    name: "Wooden Staff",
    description: "A novice mage's staff. Channels arcane orbs.",
    rarity: "common",
    type: "magic",
    requirements: { INT: 6 },
    baseDamage: 18,
    attackSpeedMod: 1.0,
    range: 280,
    knockback: { x: 60, y: -30 },
    staminaCost: 0,
    manaCost: 10,
    scaling: { INT: 0.9, INS: 0.3 },
    passive: [],
    onHit: [],
    onKill: [],
    aura: [],
    heldTexture: "wpn-wooden-staff",
    cooldownMs: 520,
    swingHeight: 0,
    swingDurationMs: 0,
    projectileSpeed: 600,
    projectileTexture: "proj-white-orb",
    projectileGravityAfterMs: 0,
    piercing: true,
    homingTurnRate: 0,
    glowTint: 0xffffff,
    glowFrequencyMs: 10,
    glowLifespanMs: 460,
  },
  iron_greatsword: {
    id: "iron_greatsword",
    name: "Iron Greatsword",
    description: "A heavy two-handed blade favoured by fighters.",
    rarity: "uncommon",
    type: "melee",
    requirements: { MIG: 10 },
    baseDamage: 22,
    attackSpeedMod: 0.85,
    range: 84,
    knockback: { x: 340, y: -200 },
    staminaCost: 14,
    manaCost: 0,
    scaling: { MIG: 1.1, VIT: 0.3 },
    passive: [],
    onHit: [],
    onKill: [],
    aura: [],
    heldTexture: "wpn-iron-greatsword",
    cooldownMs: 440,
    swingHeight: 56,
    swingDurationMs: 220,
    projectileSpeed: 0,
    projectileTexture: "",
    projectileGravityAfterMs: 0,
    piercing: false,
    homingTurnRate: 0,
    glowTint: 0,
    glowFrequencyMs: 0,
    glowLifespanMs: 0,
  },
  thieves_dagger: {
    id: "thieves_dagger",
    name: "Thieves' Dagger",
    description: "Short, quick, and merciless.",
    rarity: "common",
    type: "melee",
    requirements: { AGI: 8 },
    baseDamage: 8,
    attackSpeedMod: 1.3,
    range: 40,
    knockback: { x: 120, y: -60 },
    staminaCost: 4,
    manaCost: 0,
    scaling: { AGI: 0.9, MIG: 0.2 },
    passive: [],
    onHit: [],
    onKill: [],
    aura: [],
    heldTexture: "wpn-dagger",
    cooldownMs: 220,
    swingHeight: 32,
    swingDurationMs: 140,
    projectileSpeed: 0,
    projectileTexture: "",
    projectileGravityAfterMs: 0,
    piercing: false,
    homingTurnRate: 0,
    glowTint: 0,
    glowFrequencyMs: 0,
    glowLifespanMs: 0,
  },
  tower_shield: {
    id: "tower_shield",
    name: "Tower Shield",
    description: "A wall of metal. Bash with intent.",
    rarity: "uncommon",
    type: "melee",
    requirements: { VIT: 10, MIG: 6 },
    baseDamage: 10,
    attackSpeedMod: 0.7,
    range: 56,
    knockback: { x: 420, y: -120 },
    staminaCost: 18,
    manaCost: 0,
    scaling: { VIT: 0.8, MIG: 0.4 },
    passive: [{ id: "def_aura", description: "+10 DEF while equipped", value: 10 }],
    onHit: [],
    onKill: [],
    aura: [],
    heldTexture: "wpn-tower-shield",
    cooldownMs: 540,
    swingHeight: 60,
    swingDurationMs: 240,
    projectileSpeed: 0,
    projectileTexture: "",
    projectileGravityAfterMs: 0,
    piercing: false,
    homingTurnRate: 0,
    glowTint: 0,
    glowFrequencyMs: 0,
    glowLifespanMs: 0,
  },
};

// Compute final base damage for an attacker. Adds scaling*attribute on top of
// baseDamage so the same weapon hits harder in the hands of the right build.
export function computeWeaponDamage(
  w: WeaponDef,
  attrs: Partial<Record<AttributeKey, number>>,
): number {
  let dmg = w.baseDamage;
  for (const key of Object.keys(w.scaling) as AttributeKey[]) {
    const coeff = w.scaling[key] ?? 0;
    const v = attrs[key] ?? 0;
    dmg += coeff * v;
  }
  return Math.round(dmg);
}

// Returns true if the wielder satisfies every requirement.
export function meetsWeaponRequirements(
  w: WeaponDef,
  attrs: Partial<Record<AttributeKey, number>>,
): boolean {
  for (const key of Object.keys(w.requirements) as AttributeKey[]) {
    const need = w.requirements[key] ?? 0;
    const have = attrs[key] ?? 0;
    if (have < need) return false;
  }
  return true;
}

// Effective attack cooldown in milliseconds — slower weapons have lower
// attackSpeedMod values, making cooldownMs larger.
export function weaponCooldownMs(w: WeaponDef): number {
  return Math.round(w.cooldownMs / Math.max(0.1, w.attackSpeedMod));
}

export function buildWeaponTextures(scene: Phaser.Scene): void {
  drawTex(scene, "wpn-wooden-sword", 18, 22, (g) => {
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(8, 15, 2, 7);
    g.fillStyle(0x3a3f55, 1);
    g.fillRect(4, 14, 10, 1);
    g.fillStyle(0xc8b07a, 1);
    g.fillRect(8, 1, 2, 13);
    g.fillStyle(0xe6d2a0, 1);
    g.fillRect(9, 1, 1, 13);
  });
  drawTex(scene, "wpn-wooden-bow", 14, 22, (g) => {
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(6, 1, 2, 20);
    g.fillRect(2, 2, 4, 2);
    g.fillRect(2, 18, 4, 2);
    g.fillStyle(0xeeeeee, 1);
    g.fillRect(3, 4, 1, 14);
  });
  drawTex(scene, "wpn-wooden-staff", 12, 24, (g) => {
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(5, 7, 2, 17);
    g.fillStyle(0x4a2f1a, 1);
    g.fillRect(5, 11, 2, 1);
    g.fillRect(5, 17, 2, 1);
    g.fillStyle(0x9070ff, 1);
    g.fillCircle(6, 5, 4);
    g.fillStyle(0xd0b0ff, 0.85);
    g.fillCircle(5, 4, 2);
  });
  drawTex(scene, "wpn-iron-greatsword", 22, 30, (g) => {
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(10, 22, 2, 7);
    g.fillStyle(0x3a3f55, 1);
    g.fillRect(4, 21, 14, 2);
    g.fillStyle(0xb8c0d0, 1);
    g.fillRect(9, 2, 4, 19);
    g.fillStyle(0xdfe6f0, 1);
    g.fillRect(10, 2, 2, 19);
    g.fillStyle(0x7a8090, 1);
    g.fillTriangle(9, 2, 13, 2, 11, 0);
  });
  drawTex(scene, "wpn-dagger", 12, 16, (g) => {
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(5, 11, 2, 4);
    g.fillStyle(0x3a3f55, 1);
    g.fillRect(3, 10, 6, 1);
    g.fillStyle(0xc8b07a, 1);
    g.fillRect(5, 2, 2, 8);
    g.fillStyle(0xe6d2a0, 1);
    g.fillRect(6, 2, 1, 8);
  });
  drawTex(scene, "wpn-tower-shield", 24, 32, (g) => {
    g.fillStyle(0x5a4530, 1);
    g.fillRect(2, 4, 20, 24);
    g.fillStyle(0x8a6840, 1);
    g.fillRect(4, 6, 16, 20);
    g.fillStyle(0xc0a070, 1);
    g.fillRect(10, 8, 4, 16);
    g.fillStyle(0x3a2a18, 1);
    g.fillRect(4, 14, 16, 1);
  });
  drawTex(scene, "proj-arrow", 18, 8, (g) => {
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(2, 3, 10, 2);
    g.fillStyle(0xcfd6e6, 1);
    g.fillTriangle(12, 1, 12, 7, 17, 4);
    g.fillStyle(0xaaaaaa, 1);
    g.fillRect(0, 1, 2, 6);
  });
  drawTex(scene, "proj-orb", 14, 14, (g) => {
    g.fillStyle(0x9070ff, 1);
    g.fillCircle(7, 7, 6);
    g.fillStyle(0xd0b0ff, 0.85);
    g.fillCircle(6, 6, 3);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(5, 5, 1);
  });
  drawTex(scene, "proj-white-orb", 16, 16, (g) => {
    g.fillStyle(0xb0d0ff, 0.55);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 5);
  });
}

function drawTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}
