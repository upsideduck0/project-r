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
  drawIcon(scene, "skill-focus", (g) => {
    // Orange crosshair / power symbol
    g.fillStyle(0xff9040, 1);
    g.fillCircle(16, 16, 11);
    g.fillStyle(0x1a1a2a, 1);
    g.fillCircle(16, 16, 7);
    g.fillStyle(0xff9040, 1);
    g.fillRect(14, 4, 4, 12);
    g.fillRect(14, 18, 4, 10);
    g.fillRect(4, 14, 10, 4);
    g.fillRect(18, 14, 10, 4);
    g.fillStyle(0xffe0a0, 1);
    g.fillCircle(16, 16, 3);
  });
  drawIcon(scene, "skill-nimble", (g) => {
    // Cyan double-chevron / swift arrow
    g.fillStyle(0x40d0ff, 1);
    g.fillTriangle(6, 16, 14, 8, 14, 24);
    g.fillTriangle(14, 16, 22, 8, 22, 24);
    g.fillStyle(0xa0f0ff, 0.7);
    g.fillTriangle(8, 16, 14, 10, 14, 22);
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
