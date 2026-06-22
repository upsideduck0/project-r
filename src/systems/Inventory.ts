export interface ItemStack {
  itemId: string;
  count: number;
}

export type SlotSection = "main" | "utility" | "skill";

export interface SlotRef {
  section: SlotSection;
  index: number;
}

export const MAIN_ROWS = 3;
export const COLS = 10;
export const MAIN_SIZE = MAIN_ROWS * COLS;
export const HOTBAR_SIZE = COLS;

export class Inventory {
  readonly main: (ItemStack | null)[];
  readonly utility: (ItemStack | null)[];
  readonly skill: (ItemStack | null)[];

  constructor() {
    this.main = new Array(MAIN_SIZE).fill(null);
    this.utility = new Array(HOTBAR_SIZE).fill(null);
    this.skill = new Array(HOTBAR_SIZE).fill(null);
  }

  get(ref: SlotRef): ItemStack | null {
    return this.section(ref.section)[ref.index];
  }

  set(ref: SlotRef, stack: ItemStack | null): void {
    this.section(ref.section)[ref.index] = stack;
  }

  swap(a: SlotRef, b: SlotRef): void {
    if (a.section === b.section && a.index === b.index) return;
    const sa = this.section(a.section);
    const sb = this.section(b.section);
    const tmp = sa[a.index];
    sa[a.index] = sb[b.index];
    sb[b.index] = tmp;
  }

  addItem(itemId: string, count: number, maxStack: number): number {
    let remaining = count;
    const sections: SlotSection[] = ["main", "utility", "skill"];
    for (const section of sections) {
      const arr = this.section(section);
      for (let i = 0; i < arr.length; i++) {
        if (remaining <= 0) return 0;
        const s = arr[i];
        if (s && s.itemId === itemId && s.count < maxStack) {
          const space = maxStack - s.count;
          const give = Math.min(space, remaining);
          s.count += give;
          remaining -= give;
        }
      }
    }
    for (const section of sections) {
      const arr = this.section(section);
      for (let i = 0; i < arr.length; i++) {
        if (remaining <= 0) return 0;
        if (!arr[i]) {
          const give = Math.min(maxStack, remaining);
          arr[i] = { itemId, count: give };
          remaining -= give;
        }
      }
    }
    return remaining;
  }

  private section(s: SlotSection): (ItemStack | null)[] {
    if (s === "main") return this.main;
    if (s === "utility") return this.utility;
    return this.skill;
  }
}
