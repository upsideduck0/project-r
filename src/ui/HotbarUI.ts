import Phaser from "phaser";

export interface HotbarSlotDisplay {
  iconKey: string | null;
  count: number | null;
  cooldownPct: number;
  cooldownSecondsLeft: number;
  available: boolean;
}

const SLOTS = 10;
const SLOT_SIZE = 44;
const SLOT_GAP = 4;

export class HotbarUI {
  private container: Phaser.GameObjects.Container;
  private slotBgs: Phaser.GameObjects.Rectangle[] = [];
  private slotIcons: Phaser.GameObjects.Image[] = [];
  private slotCounts: Phaser.GameObjects.Text[] = [];
  private slotCdFills: Phaser.GameObjects.Rectangle[] = [];
  private slotCdTexts: Phaser.GameObjects.Text[] = [];
  private label: Phaser.GameObjects.Text;
  private flashUntil: number[] = new Array(SLOTS).fill(0);

  constructor(
    private scene: Phaser.Scene,
    private getSlot: (index: number) => HotbarSlotDisplay,
    private getModeLabel: () => { text: string; color: string },
  ) {
    const totalW = SLOTS * SLOT_SIZE + (SLOTS - 1) * SLOT_GAP;
    const startX = (scene.scale.width - totalW) / 2;
    const y = scene.scale.height - SLOT_SIZE - 14;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(1500);

    for (let i = 0; i < SLOTS; i++) {
      const x = startX + i * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
      const cy = y + SLOT_SIZE / 2;
      const bg = scene.add
        .rectangle(x, cy, SLOT_SIZE, SLOT_SIZE, 0x141728, 0.88)
        .setStrokeStyle(2, 0x4a5072, 1);
      const icon = scene.add
        .image(x, cy, "px-ground")
        .setVisible(false);
      const cdFill = scene.add
        .rectangle(x, cy + SLOT_SIZE / 2, SLOT_SIZE - 4, 0, 0x000000, 0.6)
        .setOrigin(0.5, 1);
      const cdText = scene.add
        .text(x, cy, "", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
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
      this.container.add([bg, icon, cdFill, cdText, count, num]);
      this.slotBgs.push(bg);
      this.slotIcons.push(icon);
      this.slotCdFills.push(cdFill);
      this.slotCdTexts.push(cdText);
      this.slotCounts.push(count);
    }

    this.label = scene.add
      .text(startX, y - 16, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#6fd3ff",
      })
      .setScrollFactor(0)
      .setDepth(1501);
  }

  flash(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= SLOTS) return;
    this.flashUntil[slotIndex] = this.scene.time.now + 160;
  }

  refresh(): void {
    const now = this.scene.time.now;
    const mode = this.getModeLabel();
    this.label.setText(mode.text).setColor(mode.color);
    for (let i = 0; i < SLOTS; i++) {
      const d = this.getSlot(i);
      const icon = this.slotIcons[i];
      const cdFill = this.slotCdFills[i];
      const cdText = this.slotCdTexts[i];
      const count = this.slotCounts[i];
      const bg = this.slotBgs[i];

      if (d.iconKey) {
        icon.setTexture(d.iconKey).setVisible(true);
        icon.setAlpha(d.available ? 1 : 0.45);
        count.setText(d.count != null && d.count > 1 ? String(d.count) : "");
      } else {
        icon.setVisible(false);
        count.setText("");
      }

      const cdActive = d.cooldownPct < 1 && d.cooldownPct > 0;
      if (cdActive) {
        cdFill.height = (SLOT_SIZE - 4) * (1 - d.cooldownPct);
        cdFill.setVisible(true);
        cdText.setText(d.cooldownSecondsLeft.toFixed(1)).setVisible(true);
      } else {
        cdFill.setVisible(false);
        cdText.setVisible(false);
      }

      const flashing = now < this.flashUntil[i];
      const stroke = flashing ? 0xffd060 : 0x4a5072;
      bg.setStrokeStyle(flashing ? 3 : 2, stroke, 1);
    }
  }
}
