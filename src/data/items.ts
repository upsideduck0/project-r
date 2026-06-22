import Phaser from "phaser";

export type ItemCategory = "weapon" | "consumable" | "skill" | "material";

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  category: ItemCategory;
  maxStack: number;
}

export const ITEMS: Record<string, ItemDef> = {
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    icon: "icon-iron-sword",
    category: "weapon",
    maxStack: 1,
  },
  hp_potion: {
    id: "hp_potion",
    name: "Health Potion",
    icon: "icon-hp-potion",
    category: "consumable",
    maxStack: 99,
  },
  mp_potion: {
    id: "mp_potion",
    name: "Mana Potion",
    icon: "icon-mp-potion",
    category: "consumable",
    maxStack: 99,
  },
  fireball: {
    id: "fireball",
    name: "Fireball",
    icon: "icon-fireball",
    category: "skill",
    maxStack: 1,
  },
  heal: {
    id: "heal",
    name: "Heal",
    icon: "icon-heal",
    category: "skill",
    maxStack: 1,
  },
  wood: {
    id: "wood",
    name: "Wood",
    icon: "icon-wood",
    category: "material",
    maxStack: 999,
  },
};

export function buildItemIcons(scene: Phaser.Scene): void {
  drawIcon(scene, "icon-iron-sword", (g) => {
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(15, 24, 2, 6);
    g.fillStyle(0x2a2f3c, 1);
    g.fillRect(8, 21, 16, 3);
    g.fillStyle(0xcfd6e6, 1);
    g.fillRect(14, 4, 4, 18);
    g.fillStyle(0x8b94a8, 1);
    g.fillRect(15, 4, 1, 18);
  });
  drawIcon(scene, "icon-hp-potion", (g) => {
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(13, 4, 6, 5);
    g.fillStyle(0xff5a5a, 1);
    g.fillRect(8, 10, 16, 18);
    g.fillStyle(0xaa3030, 1);
    g.fillRect(8, 24, 16, 4);
    g.fillStyle(0xffb0b0, 0.6);
    g.fillRect(10, 12, 4, 8);
  });
  drawIcon(scene, "icon-mp-potion", (g) => {
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(13, 4, 6, 5);
    g.fillStyle(0x5a8aff, 1);
    g.fillRect(8, 10, 16, 18);
    g.fillStyle(0x3050aa, 1);
    g.fillRect(8, 24, 16, 4);
    g.fillStyle(0xb0c8ff, 0.6);
    g.fillRect(10, 12, 4, 8);
  });
  drawIcon(scene, "icon-fireball", (g) => {
    g.fillStyle(0xff7030, 1);
    g.fillCircle(16, 16, 11);
    g.fillStyle(0xffa030, 1);
    g.fillCircle(16, 16, 8);
    g.fillStyle(0xffe060, 1);
    g.fillCircle(14, 14, 4);
  });
  drawIcon(scene, "icon-heal", (g) => {
    g.fillStyle(0x60d060, 1);
    g.fillRect(13, 5, 6, 22);
    g.fillRect(5, 13, 22, 6);
    g.fillStyle(0xa0f0a0, 0.7);
    g.fillRect(14, 6, 2, 20);
    g.fillRect(6, 14, 20, 2);
  });
  drawIcon(scene, "icon-wood", (g) => {
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(4, 8, 24, 16);
    g.fillStyle(0x4a2f1a, 1);
    g.fillRect(4, 13, 24, 2);
    g.fillRect(4, 19, 24, 2);
    g.fillStyle(0x8a6a45, 1);
    g.fillRect(4, 9, 24, 1);
  });
}

function drawIcon(
  scene: Phaser.Scene,
  key: string,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, 32, 32);
  g.destroy();
}
