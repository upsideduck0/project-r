import { AttributeKey } from "../../systems/stats/types";

// Color identity per the design spec. Used by skill cast visuals so players
// gradually learn attribute identity through gameplay.
export const ATTRIBUTE_COLORS: Record<AttributeKey, number> = {
  VIT: 0x60d060, // green
  MIG: 0xe04050, // red
  AGI: 0xf4d35e, // yellow
  INT: 0x5a8aff, // blue
  INS: 0xb070ff, // purple
  PRE: 0xffd060, // gold
};

export function attributeColor(key: AttributeKey): number {
  return ATTRIBUTE_COLORS[key];
}
