import Phaser from "phaser";
import { Enemy } from "./Enemy";

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
      attributes: { VIT: 10, MIG: 1, AGI: 1, INT: 1, INS: 1, PRE: 1 },
      mainStats: {
        HP: 80, MP: 0, STA: 0, ATK: 5, DEF: 0, MS: 0, AS: 1, TEN: 0,
      },
      subStats: { GEN: 0 },
    });
  }
}
