import Phaser from "phaser";
import { Enemy } from "./Enemy";
import { computeStatsAtLevel } from "../systems/stats/formulas";

const DUMMY_ATTRS = { VIT: 10, MIG: 0, AGI: 0, INT: 0, INS: 0, PRE: 0 };
const DUMMY_STATS = computeStatsAtLevel(DUMMY_ATTRS, 10);

export class Dummy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-dummy",
      kind: "dummy",
      aggroRadius: 0,
      bodyW: 18,
      bodyH: 26,
      bodyOffX: 2,
      bodyOffY: 2,
      respawnMs: 3500,
      attributes: DUMMY_ATTRS,
      mainStats: DUMMY_STATS.main,
      subStats: DUMMY_STATS.sub,
    });
  }
}
