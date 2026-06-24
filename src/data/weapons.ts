import Phaser from "phaser";

export type WeaponType = "melee" | "ranged" | "magic";

export interface WeaponDef {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  cooldownMs: number;
  staminaCost: number;
  manaCost: number;
  // melee
  reach: number;
  swingHeight: number;
  swingDurationMs: number;
  // projectile
  projectileSpeed: number;
  projectileRange: number;
  projectileTexture: string;
  // visuals
  heldTexture: string;
}

export const WEAPONS: Record<string, WeaponDef> = {
  wooden_sword: {
    id: "wooden_sword",
    name: "Wooden Sword",
    type: "melee",
    damage: 14,
    cooldownMs: 320,
    staminaCost: 8,
    manaCost: 0,
    reach: 36,
    swingHeight: 24,
    swingDurationMs: 140,
    projectileSpeed: 0,
    projectileRange: 0,
    projectileTexture: "",
    heldTexture: "wpn-wooden-sword",
  },
  wooden_bow: {
    id: "wooden_bow",
    name: "Wooden Bow",
    type: "ranged",
    damage: 10,
    cooldownMs: 380,
    staminaCost: 10,
    manaCost: 0,
    reach: 0,
    swingHeight: 0,
    swingDurationMs: 0,
    projectileSpeed: 560,
    projectileRange: 540,
    projectileTexture: "proj-arrow",
    heldTexture: "wpn-wooden-bow",
  },
  wooden_staff: {
    id: "wooden_staff",
    name: "Wooden Staff",
    type: "magic",
    damage: 18,
    cooldownMs: 520,
    staminaCost: 0,
    manaCost: 14,
    reach: 0,
    swingHeight: 0,
    swingDurationMs: 0,
    projectileSpeed: 440,
    projectileRange: 500,
    projectileTexture: "proj-orb",
    heldTexture: "wpn-wooden-staff",
  },
};

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
