import Phaser from "phaser";

export function buildSkillIcons(scene: Phaser.Scene): void {
  drawIcon(scene, "skill-fireball", (g) => {
    g.fillStyle(0xff7030, 1);
    g.fillCircle(16, 16, 11);
    g.fillStyle(0xffa030, 1);
    g.fillCircle(16, 16, 8);
    g.fillStyle(0xffe060, 1);
    g.fillCircle(14, 14, 4);
  });
  drawIcon(scene, "skill-heal", (g) => {
    g.fillStyle(0x60d060, 1);
    g.fillRect(13, 5, 6, 22);
    g.fillRect(5, 13, 22, 6);
    g.fillStyle(0xa0f0a0, 0.7);
    g.fillRect(14, 6, 2, 20);
    g.fillRect(6, 14, 20, 2);
  });
  drawIcon(scene, "skill-surge", (g) => {
    g.fillStyle(0xf4d35e, 1);
    g.fillTriangle(16, 4, 24, 16, 18, 16);
    g.fillTriangle(18, 16, 24, 16, 14, 28);
    g.fillTriangle(14, 28, 18, 16, 8, 16);
    g.fillTriangle(8, 16, 18, 16, 16, 4);
  });
  drawIcon(scene, "skill-blink", (g) => {
    g.fillStyle(0x6fd3ff, 1);
    g.fillCircle(10, 16, 4);
    g.fillCircle(22, 16, 4);
    g.fillStyle(0xb0e5ff, 0.7);
    g.fillRect(11, 14, 11, 4);
  });
  const fg = scene.make.graphics({ x: 0, y: 0 }, false);
  fg.fillStyle(0xff5020, 1);
  fg.fillCircle(8, 8, 7);
  fg.fillStyle(0xff9040, 1);
  fg.fillCircle(8, 8, 5);
  fg.fillStyle(0xffe060, 0.9);
  fg.fillCircle(7, 7, 2);
  fg.generateTexture("proj-fireball", 16, 16);
  fg.destroy();
}

function drawIcon(
  scene: Phaser.Scene,
  key: string,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, 32, 32);
  g.destroy();
}
