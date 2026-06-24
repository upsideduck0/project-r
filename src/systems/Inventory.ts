export interface ItemStack {
  itemId: string;
  count: number;
}

export interface SkillRef {
  skillId: string;
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
  readonly skill: (SkillRef | null)[];

  constructor() {
    this.main = new Array(MAIN_SIZE).fill(null);
    this.utility = new Array(HOTBAR_SIZE).fill(null);
    this.skill = new Array(HOTBAR_SIZE).fill(null);
  }

  getItem(section: "main" | "utility", index: number): ItemStack | null {
    return (section === "main" ? this.main : this.utility)[index];
  }

  setItem(
    section: "main" | "utility",
    index: number,
    stack: ItemStack | null,
  ): void {
    (section === "main" ? this.main : this.utility)[index] = stack;
  }

  getSkill(index: number): SkillRef | null {
    return this.skill[index];
  }

  setSkill(index: number, ref: SkillRef | null): void {
    this.skill[index] = ref;
  }

  addItem(
    section: "main" | "utility",
    itemId: string,
    count: number,
    maxStack: number,
  ): number {
    const arr = section === "main" ? this.main : this.utility;
    let remaining = count;
    for (let i = 0; i < arr.length; i++) {
      if (remaining <= 0) return 0;
      const s = arr[i];
      if (s && s.itemId === itemId && s.count < maxStack) {
        const give = Math.min(maxStack - s.count, remaining);
        s.count += give;
        remaining -= give;
      }
    }
    for (let i = 0; i < arr.length; i++) {
      if (remaining <= 0) return 0;
      if (!arr[i]) {
        const give = Math.min(maxStack, remaining);
        arr[i] = { itemId, count: give };
        remaining -= give;
      }
    }
    return remaining;
  }

  consumeUtility(index: number): ItemStack | null {
    const s = this.utility[index];
    if (!s) return null;
    s.count -= 1;
    if (s.count <= 0) this.utility[index] = null;
    return s;
  }
}
