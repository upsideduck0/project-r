import Phaser from "phaser";
import {
  COLS,
  HOTBAR_SIZE,
  Inventory,
  MAIN_ROWS,
  SlotRef,
  SlotSection,
} from "../systems/Inventory";
import { ITEMS } from "../data/items";

const SLOT_SIZE = 40;
const SLOT_GAP = 4;

interface SlotView {
  ref: SlotRef;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
  homeX: number;
  homeY: number;
}

export class InventoryUI {
  private scene: Phaser.Scene;
  private inv: Inventory;
  private container: Phaser.GameObjects.Container;
  private slots: SlotView[] = [];
  private dragFrom: SlotRef | null = null;
  private onChange: () => void;
  open = false;

  constructor(scene: Phaser.Scene, inv: Inventory, onChange: () => void) {
    this.scene = scene;
    this.inv = inv;
    this.onChange = onChange;
    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(3000)
      .setVisible(false);

    const w = scene.scale.width;
    const h = scene.scale.height;
    const totalW = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP;
    const startX = (w - totalW) / 2;
    let cursorY = 60;

    const overlay = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.65)
      .setOrigin(0)
      .setScrollFactor(0);
    this.container.add(overlay);

    const title = scene.add.text(startX, cursorY - 32, "INVENTORY", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#e6e6e6",
    });
    const hint = scene.add.text(
      startX,
      cursorY - 14,
      "Drag items between slots. Tab to close.",
      { fontFamily: "monospace", fontSize: "10px", color: "#8a92aa" },
    );
    this.container.add([title, hint]);

    this.buildSection("main", MAIN_ROWS, startX, cursorY);
    cursorY += MAIN_ROWS * (SLOT_SIZE + SLOT_GAP) + 24;

    const utilLabel = scene.add.text(
      startX,
      cursorY - 16,
      "Utility hotbar (sheathed)",
      { fontFamily: "monospace", fontSize: "11px", color: "#6fd3ff" },
    );
    this.container.add(utilLabel);
    this.buildSection("utility", 1, startX, cursorY);
    cursorY += SLOT_SIZE + SLOT_GAP + 18;

    const skillLabel = scene.add.text(
      startX,
      cursorY - 16,
      "Skill hotbar (battle mode)",
      { fontFamily: "monospace", fontSize: "11px", color: "#ff8a5a" },
    );
    this.container.add(skillLabel);
    this.buildSection("skill", 1, startX, cursorY);

    this.attachDragHandlers();
    this.refresh();
  }

  private buildSection(
    section: SlotSection,
    rows: number,
    x0: number,
    y0: number,
  ): void {
    const total =
      section === "main"
        ? MAIN_ROWS * COLS
        : HOTBAR_SIZE;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (i >= total) break;
        const x = x0 + c * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
        const y = y0 + r * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
        const bg = this.scene.add
          .rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x141728, 0.92)
          .setStrokeStyle(2, 0x4a5072, 1);
        const icon = this.scene.add
          .image(x, y, "icon-iron-sword")
          .setVisible(false);
        const count = this.scene.add
          .text(x + SLOT_SIZE / 2 - 3, y + SLOT_SIZE / 2 - 2, "", {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#ffffff",
          })
          .setOrigin(1, 1);
        const ref: SlotRef = { section, index: i };
        bg.setData("ref", ref);
        bg.setInteractive({ dropZone: true });
        icon.setData("ref", ref);
        icon.setInteractive({ useHandCursor: true });
        icon.input!.enabled = false;
        this.scene.input.setDraggable(icon);
        this.container.add([bg, icon, count]);
        this.slots.push({ ref, bg, icon, count, homeX: x, homeY: y });
      }
    }
  }

  private attachDragHandlers(): void {
    const inp = this.scene.input;
    inp.on(
      "dragstart",
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
        if (!this.open) return;
        const img = obj as Phaser.GameObjects.Image;
        const ref = img.getData("ref") as SlotRef;
        this.dragFrom = ref;
        img.setAlpha(0.85);
        this.container.bringToTop(img);
      },
    );
    inp.on(
      "drag",
      (
        _p: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        if (!this.open) return;
        const img = obj as Phaser.GameObjects.Image;
        img.setPosition(dragX, dragY);
      },
    );
    inp.on(
      "drop",
      (
        _p: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.GameObject,
        target: Phaser.GameObjects.GameObject,
      ) => {
        if (!this.open) return;
        const to = (target as Phaser.GameObjects.Rectangle).getData(
          "ref",
        ) as SlotRef | undefined;
        if (this.dragFrom && to) {
          this.inv.swap(this.dragFrom, to);
        }
        const img = obj as Phaser.GameObjects.Image;
        img.setAlpha(1);
        this.refresh();
        this.onChange();
      },
    );
    inp.on(
      "dragend",
      (
        _p: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.GameObject,
        dropped: boolean,
      ) => {
        if (!this.open) return;
        const img = obj as Phaser.GameObjects.Image;
        img.setAlpha(1);
        this.dragFrom = null;
        if (!dropped) this.refresh();
      },
    );
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.container.setVisible(open);
    for (const s of this.slots) {
      if (s.icon.input) s.icon.input.enabled = open && s.icon.visible;
    }
    if (open) this.refresh();
  }

  refresh(): void {
    for (const s of this.slots) {
      const stack = this.inv.get(s.ref);
      if (stack) {
        const def = ITEMS[stack.itemId];
        s.icon
          .setTexture(def.icon)
          .setPosition(s.homeX, s.homeY)
          .setVisible(true)
          .setAlpha(1);
        if (s.icon.input) s.icon.input.enabled = this.open;
        s.count.setText(stack.count > 1 ? String(stack.count) : "");
      } else {
        s.icon.setVisible(false);
        if (s.icon.input) s.icon.input.enabled = false;
        s.count.setText("");
      }
    }
  }
}
