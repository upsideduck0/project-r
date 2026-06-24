import Phaser from "phaser";
import { ProjectileSpawnConfig } from "../systems/Projectiles";

export interface PlayerHandle {
  x: number;
  y: number;
  facing: 1 | -1;
}

export interface SkillCaster {
  player(): PlayerHandle;
  cursor(): { x: number; y: number };
  healPlayer(amount: number): void;
  restoreMana(amount: number): void;
  restoreStamina(amount: number): void;
  blinkPlayer(distancePx: number): void;
  applyInvulnFor(ms: number): void;
  spawnPlayerProjectile(cfg: ProjectileSpawnConfig): void;
  flashPlayer(color: number, ms: number): void;
}

export interface SkillDef {
  id: string;
  name: string;
  manaCost: number;
  cooldownMs: number;
  iconKey: string;
  cast: (caster: SkillCaster) => void;
}

export const SKILLS: Record<string, SkillDef> = {
  fireball: {
    id: "fireball",
    name: "Fireball",
    manaCost: 12,
    cooldownMs: 600,
    iconKey: "skill-fireball",
    cast: (c) => {
      const p = c.player();
      const tgt = c.cursor();
      let dx = tgt.x - p.x;
      let dy = tgt.y - p.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) {
        dx = p.facing;
        dy = 0;
      } else {
        dx /= len;
        dy /= len;
      }
      c.spawnPlayerProjectile({
        x: p.x + p.facing * 6,
        y: p.y,
        vx: dx * 480,
        vy: dy * 480,
        damage: 26,
        texture: "proj-fireball",
        range: 520,
        rotation: Math.atan2(dy, dx),
        knockX: 160,
        knockY: -90,
        homingTurnRate: 0,
        gravityAfterMs: 0,
        piercing: false,
        glowTint: 0xff8030,
        glowFrequencyMs: 16,
        glowLifespanMs: 360,
      });
    },
  },
  heal: {
    id: "heal",
    name: "Heal",
    manaCost: 18,
    cooldownMs: 4000,
    iconKey: "skill-heal",
    cast: (c) => {
      c.healPlayer(40);
      c.flashPlayer(0x60d060, 220);
    },
  },
  surge: {
    id: "surge",
    name: "Stamina Surge",
    manaCost: 10,
    cooldownMs: 5000,
    iconKey: "skill-surge",
    cast: (c) => {
      c.restoreStamina(60);
      c.flashPlayer(0xf4d35e, 180);
    },
  },
  blink: {
    id: "blink",
    name: "Blink",
    manaCost: 14,
    cooldownMs: 2000,
    iconKey: "skill-blink",
    cast: (c) => {
      c.blinkPlayer(140);
      c.applyInvulnFor(220);
      c.flashPlayer(0x6fd3ff, 180);
    },
  },
};

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
