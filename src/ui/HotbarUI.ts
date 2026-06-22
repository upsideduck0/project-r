import Phaser from "phaser";
import { COLS, Inventory, SlotRef } from "../systems/Inventory";
import { ITEMS } from "../data/items";

const SLOT_SIZE = 44;
const SLOT_GAP = 4;

export class HotbarUI {
  private scene: Phaser.Scene;
  private inv: Inventory;
  private container: Phaser.GameObjects.Container;
  private slotBgs: Phaser.GameObjects.Rectangle[] = [];
  private slotIcons: Phaser.GameObjects.Image[] = [];
  private slotCounts: Phaser.GameObjects.Text[] = [];
  private label: Phaser.GameObjects.Text;
  selected = 0;
  battleMode = false;

  constructor(scene: Phaser.Scene, inv: Inventory) {
    this.scene = scene;
    this.inv = inv;
    const totalW = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP;
    const startX = (scene.scale.width - totalW) / 2;
    const y = scene.scale.height - SLOT_SIZE - 12;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(1500);
    for (let i = 0; i < COLS; i++) {
      const x = startX + i * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
      const cy = y + SLOT_SIZE / 2;
      const bg = scene.add
        .rectangle(x, cy, SLOT_SIZE, SLOT_SIZE, 0x141728, 0.85)
        .setStrokeStyle(2, 0x4a5072, 1);
      const icon = scene.add
        .image(x, cy, "icon-iron-sword")
        .setVisible(false);
      const count = scene.add
        .text(x + SLOT_SIZE / 2 - 3, cy + SLOT_SIZE / 2 - 2, "", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ffffff",
        })
        .setOrigin(1, 1);
      const num = scene.add.text(
        x - SLOT_SIZE / 2 + 3,
        cy - SLOT_SIZE / 2 + 1,
        String((i + 1) % 10),
        { fontFamily: "monospace", fontSize: "10px", color: "#8a92aa" },
      );
      this.container.add([bg, icon, count, num]);
      this.slotBgs.push(bg);
      this.slotIcons.push(icon);
      this.slotCounts.push(count);
    }
    this.label = scene.add
      .text(startX, y - 16, "Utility", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#6fd3ff",
      })
      .setScrollFactor(0)
      .setDepth(1501);
    this.refresh();
  }

  setBattleMode(active: boolean): void {
    this.battleMode = active;
    this.label.setText(active ? "Battle (skills)" : "Utility");
    this.label.setColor(active ? "#ff8a5a" : "#6fd3ff");
    this.refresh();
  }

  setSelected(i: number): void {
    this.selected = Phaser.Math.Clamp(i, 0, COLS - 1);
    this.refresh();
  }

  getSelectedRef(): SlotRef {
    return {
      section: this.battleMode ? "skill" : "utility",
      index: this.selected,
    };
  }

  refresh(): void {
    const arr = this.battleMode ? this.inv.skill : this.inv.utility;
    for (let i = 0; i < COLS; i++) {
      const stack = arr[i];
      if (stack) {
        const def = ITEMS[stack.itemId];
        this.slotIcons[i].setTexture(def.icon).setVisible(true);
        this.slotCounts[i].setText(stack.count > 1 ? String(stack.count) : "");
      } else {
        this.slotIcons[i].setVisible(false);
        this.slotCounts[i].setText("");
      }
      const accent = this.battleMode ? 0xff8a5a : 0x6fd3ff;
      const stroke = i === this.selected ? accent : 0x4a5072;
      this.slotBgs[i].setStrokeStyle(i === this.selected ? 3 : 2, stroke, 1);
    }
  }
}
