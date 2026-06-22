import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

const WIDTH = 960;
const HEIGHT = 540;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#1a1d2b",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 900 },
      debug: false,
    },
  },
  scene: [GameScene],
});
