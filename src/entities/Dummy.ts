import Phaser from "phaser";
import { Enemy } from "./Enemy";

export class Dummy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: "px-dummy",
      maxHp: 80,
      aggroRadius: 0,
      contactDamage: 5,
      bodyW: 18,
      bodyH: 26,
      bodyOffX: 2,
      bodyOffY: 2,
      respawnMs: 3500,
      kind: "dummy",
      attributes: { VIT: 10, MIG: 1, AGI: 1, INT: 1, INS: 1, PRE: 1 },
    });
  }
}
