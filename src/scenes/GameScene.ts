import Phaser from "phaser";
import { WEAPONS, WeaponDef, buildWeaponTextures } from "../data/weapons";
import { ProjectileSpawnConfig, ProjectileSystem } from "../systems/Projectiles";
import {
  ITEMS,
  buildItemIcons,
} from "../data/items";
import { Inventory } from "../systems/Inventory";
import { SKILLS, SkillCaster, buildSkillIcons } from "../data/skills";
import { HotbarUI, HotbarSlotDisplay } from "../ui/HotbarUI";
import { Enemy } from "../entities/Enemy";
import { Dummy } from "../entities/Dummy";
import { MeleeChaser } from "../entities/MeleeChaser";
import { RangedEnemy } from "../entities/RangedEnemy";

const WORLD_WIDTH = 2880;
const WORLD_HEIGHT = 540;
const GROUND_Y = 480;

const PLAYER_SPEED = 220;
const PLAYER_MAX_HP = 100;
const JUMP_VELOCITY = 440;
const JUMP_STAMINA_COST = 15;
const DASH_SPEED = 620;
const DASH_DURATION_MS = 160;
const DASH_STAMINA_COST = 25;
const STEP_UP_VELOCITY = 360;
const DROP_THROUGH_MS = 280;

const MAX_STAMINA = 100;
const STAMINA_REGEN_PER_SEC = 35;
const MAX_MANA = 100;
const MANA_REGEN_PER_SEC = 10;

const TOUCH_COOLDOWN_MS = 800;
const HP_POTION_HEAL = 30;
const MP_POTION_RESTORE = 30;

type PlayerSprite = Phaser.Physics.Arcade.Sprite & {
  hp: number;
  stamina: number;
  mana: number;
  facing: 1 | -1;
  lastAttackAt: number;
  lastHurtAt: number;
  invulnUntil: number;
  dashUntil: number;
  dashDir: 1 | -1;
  dropThroughUntil: number;
  weapon: WeaponDef;
};

type OneWayPlatform = Phaser.Physics.Arcade.Image;

export class GameScene extends Phaser.Scene {
  private player!: PlayerSprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyEntities: Enemy[] = [];
  private solidPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private oneWayPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private attackHitbox!: Phaser.GameObjects.Rectangle & {
    body: Phaser.Physics.Arcade.Body;
  };
  private playerProjectiles!: ProjectileSystem;
  private enemyProjectiles!: ProjectileSystem;
  private inventory!: Inventory;
  private hotbarUI!: HotbarUI;
  private caster!: SkillCaster;
  private skillCooldownUntil = new Map<string, number>();

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyQ!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private weaponKeys: Phaser.Input.Keyboard.Key[] = [];
  private hotbarKeys: Phaser.Input.Keyboard.Key[] = [];

  private hudBars!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private staText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private weaponPanel!: Phaser.GameObjects.Text;
  private weaponIcon!: Phaser.GameObjects.Image;
  private weaponVisual!: Phaser.GameObjects.Image;

  private combatMode = false;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.makePixelTexture("px-player", 18, 28, 0x6fd3ff, 0x254a5a);
    this.makePixelTexture("px-dummy", 22, 30, 0xb89070, 0x5a4530);
    this.makePixelTexture("px-chaser", 20, 28, 0xe05050, 0x5a2020);
    this.makePixelTexture("px-ranged", 18, 28, 0x9070ff, 0x3a2580);
    this.makePixelTexture("px-ground", 64, 16, 0x3a3f55, 0x1c1f2b);
    this.makePixelTexture("px-platform", 96, 12, 0x4a5072, 0x252a3d);
    buildWeaponTextures(this);
    buildItemIcons(this);
    buildSkillIcons(this);
    this.makeOrb("proj-enemy-shot", 0xff6f7a);
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.drawParallaxBackground();
    this.solidPlatforms = this.physics.add.staticGroup();
    this.oneWayPlatforms = this.physics.add.staticGroup();
    this.buildLevel();

    this.player = this.spawnPlayer(80, GROUND_Y - 60);

    this.enemies = this.physics.add.group();
    this.spawnEnemies();

    this.attackHitbox = this.add.rectangle(0, 0, 36, 24, 0xffe680, 0) as
      Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    this.physics.add.existing(this.attackHitbox);
    this.attackHitbox.body.setAllowGravity(false);
    this.attackHitbox.body.enable = false;

    this.playerProjectiles = new ProjectileSystem(this);
    this.enemyProjectiles = new ProjectileSystem(this);

    this.setupCollisions();
    this.setupInput();

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(120, 80);

    this.inventory = new Inventory();
    this.seedInventory();
    this.caster = this.buildSkillCaster();

    this.buildHud();
    this.hotbarUI = new HotbarUI(
      this,
      (i) => this.describeHotbarSlot(i),
      () => this.describeHotbarMode(),
    );

    this.setWeapon("wooden_sword");
  }

  update(_time: number, delta: number): void {
    if (!this.player.active) return;
    const now = this.time.now;
    const dt = delta / 1000;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) this.tryJump();
    if (Phaser.Input.Keyboard.JustDown(this.keyQ)) this.tryDash(-1);
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.tryDash(1);
    if (Phaser.Input.Keyboard.JustDown(this.keyW)) this.tryStepUp();
    if (Phaser.Input.Keyboard.JustDown(this.keyS)) this.tryDropThrough();
    if (Phaser.Input.Keyboard.JustDown(this.weaponKeys[0]))
      this.setWeapon("wooden_sword");
    if (Phaser.Input.Keyboard.JustDown(this.weaponKeys[1]))
      this.setWeapon("wooden_bow");
    if (Phaser.Input.Keyboard.JustDown(this.weaponKeys[2]))
      this.setWeapon("wooden_staff");
    for (let i = 0; i < this.hotbarKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.hotbarKeys[i])) {
        this.useHotbarSlot(i);
      }
    }

    const dashing = now < this.player.dashUntil;
    const left = this.cursors.left?.isDown || this.keyA.isDown;
    const right = this.cursors.right?.isDown || this.keyD.isDown;
    if (!dashing) {
      if (left && !right) {
        body.setVelocityX(-PLAYER_SPEED);
        this.player.facing = -1;
        this.player.setFlipX(true);
      } else if (right && !left) {
        body.setVelocityX(PLAYER_SPEED);
        this.player.facing = 1;
        this.player.setFlipX(false);
      } else {
        body.setVelocityX(0);
      }
    } else {
      body.setVelocityX(DASH_SPEED * this.player.dashDir);
    }
    body.setAllowGravity(!dashing);
    if (dashing) body.setVelocityY(0);

    if (this.attackHitbox.body.enable) {
      const offsetX = this.player.facing * (this.player.weapon.reach / 2);
      this.attackHitbox.setPosition(this.player.x + offsetX, this.player.y);
      (this.attackHitbox.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
    }

    const playerView = {
      x: this.player.x,
      y: this.player.y,
      facing: this.player.facing,
      alive: this.player.active,
    };
    for (const e of this.enemyEntities) e.update(now, dt, playerView);

    this.updateWeaponVisual(now);
    this.playerProjectiles.update(dt);
    this.enemyProjectiles.update(dt);

    if (this.player.y > WORLD_HEIGHT + 100) this.damagePlayer(PLAYER_MAX_HP);

    this.player.stamina = Math.min(
      MAX_STAMINA,
      this.player.stamina + STAMINA_REGEN_PER_SEC * dt,
    );
    this.player.mana = Math.min(
      MAX_MANA,
      this.player.mana + MANA_REGEN_PER_SEC * dt,
    );

    this.drawHud();
    this.hotbarUI.refresh();
  }

  // -------- Setup --------

  private setupCollisions(): void {
    this.physics.add.collider(this.player, this.solidPlatforms);
    this.physics.add.collider(this.enemies, this.solidPlatforms);
    this.physics.add.collider(
      this.player,
      this.oneWayPlatforms,
      undefined,
      (_p, plat) => this.shouldCollideOneWay(plat as OneWayPlatform),
      this,
    );
    this.physics.add.collider(this.enemies, this.oneWayPlatforms);

    this.physics.add.overlap(
      this.player,
      this.enemies,
      (_p, e) => this.onPlayerTouchEnemy(e as Phaser.Physics.Arcade.Sprite),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.attackHitbox,
      this.enemies,
      (_hb, e) => this.onMeleeHit(e as Phaser.Physics.Arcade.Sprite),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.playerProjectiles.getGroup(),
      this.enemies,
      (proj, e) =>
        this.onPlayerProjectileHit(
          proj as Phaser.Physics.Arcade.Image,
          e as Phaser.Physics.Arcade.Sprite,
        ),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.playerProjectiles.getGroup(),
      this.solidPlatforms,
      (proj) => {
        const p = proj as Phaser.Physics.Arcade.Image;
        if (p.getData("piercing")) return;
        this.playerProjectiles.markForDestroy(p);
      },
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.enemyProjectiles.getGroup(),
      this.player,
      (proj) =>
        this.onEnemyProjectileHit(proj as Phaser.Physics.Arcade.Image),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.enemyProjectiles.getGroup(),
      this.solidPlatforms,
      (proj) =>
        this.enemyProjectiles.markForDestroy(
          proj as Phaser.Physics.Arcade.Image,
        ),
      undefined,
      this,
    );
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyQ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.weaponKeys = [
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.C),
    ];
    const digitCodes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
      Phaser.Input.Keyboard.KeyCodes.EIGHT,
      Phaser.Input.Keyboard.KeyCodes.NINE,
      Phaser.Input.Keyboard.KeyCodes.ZERO,
    ];
    this.hotbarKeys = digitCodes.map((c) => kb.addKey(c));

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 2) this.toggleCombatMode();
      else if (pointer.button === 0) this.onLeftClick();
    });
  }

  // -------- Enemy setup --------

  private spawnEnemies(): void {
    const dummies = [new Dummy(this, 400, GROUND_Y - 60), new Dummy(this, 1500, GROUND_Y - 60)];
    const chasers = [
      new MeleeChaser(this, 820, GROUND_Y - 60),
      new MeleeChaser(this, 1900, GROUND_Y - 60),
    ];
    const ranged = [
      new RangedEnemy(this, 1200, 250),
      new RangedEnemy(this, 2300, GROUND_Y - 60),
    ];
    for (const r of ranged) {
      r.fireProjectile = (cfg) => this.enemyProjectiles.spawn(cfg);
    }
    this.enemyEntities.push(...dummies, ...chasers, ...ranged);
    for (const e of this.enemyEntities) this.enemies.add(e.sprite);
  }

  // -------- Player movement --------

  private tryJump(): void {
    if (this.player.stamina < JUMP_STAMINA_COST) return;
    this.player.stamina -= JUMP_STAMINA_COST;
    this.player.dashUntil = 0;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocityY(-JUMP_VELOCITY);
  }

  private tryDash(dir: 1 | -1): void {
    if (this.player.stamina < DASH_STAMINA_COST) return;
    this.player.stamina -= DASH_STAMINA_COST;
    this.player.dashUntil = this.time.now + DASH_DURATION_MS;
    this.player.dashDir = dir;
    this.player.facing = dir;
    this.player.setFlipX(dir === -1);
    this.spawnDashTrail();
  }

  private tryStepUp(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down && !body.touching.down) return;
    const px = this.player.x;
    const py = this.player.y;
    let target: OneWayPlatform | null = null;
    let bestDy = Infinity;
    this.oneWayPlatforms.children.iterate((obj) => {
      const p = obj as OneWayPlatform;
      const top = p.y - p.displayHeight / 2;
      const dy = py - top;
      if (dy > 8 && dy < 140 && Math.abs(p.x - px) < p.displayWidth / 2 + 40) {
        if (dy < bestDy) {
          bestDy = dy;
          target = p;
        }
      }
      return true;
    });
    if (target) body.setVelocityY(-STEP_UP_VELOCITY);
  }

  private tryDropThrough(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down && !body.touching.down) return;
    this.player.dropThroughUntil = this.time.now + DROP_THROUGH_MS;
    body.setVelocityY(60);
  }

  private shouldCollideOneWay(plat: OneWayPlatform): boolean {
    if (this.time.now < this.player.dropThroughUntil) return false;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const platTop = plat.y - plat.displayHeight / 2;
    const playerBottom = this.player.y + body.halfHeight;
    return playerBottom <= platTop + 4 && body.velocity.y >= 0;
  }

  // -------- Combat mode + clicks --------

  private toggleCombatMode(): void {
    this.combatMode = !this.combatMode;
    this.modeText
      .setText(this.combatMode ? "COMBAT MODE" : "EXPLORATION MODE")
      .setColor(this.combatMode ? "#ff8a5a" : "#6fd3ff");
    this.player.setTint(this.combatMode ? 0xffd060 : 0xffffff);
    this.time.delayedCall(80, () => this.player.clearTint());
  }

  private onLeftClick(): void {
    if (this.combatMode) this.fireWeapon();
  }

  // -------- Weapons --------

  private setWeapon(id: string): void {
    const w = WEAPONS[id];
    if (!w) return;
    this.player.weapon = w;
    this.weaponIcon.setTexture(w.heldTexture);
    this.refreshWeaponPanel();
  }

  private refreshWeaponPanel(): void {
    const lines: string[] = [];
    const ids = ["wooden_sword", "wooden_bow", "wooden_staff"];
    const keys = ["Z", "X", "C"];
    for (let i = 0; i < ids.length; i++) {
      const w = WEAPONS[ids[i]];
      const sel = this.player.weapon.id === w.id ? ">" : " ";
      const sta = w.staminaCost ? ` ${w.staminaCost}sta` : "";
      const mp = w.manaCost ? ` ${w.manaCost}mp` : "";
      lines.push(`${sel} ${keys[i]}: ${w.name} (${w.damage} dmg${sta}${mp})`);
    }
    this.weaponPanel.setText(lines.join("\n"));
  }

  private fireWeapon(): void {
    const w = this.player.weapon;
    const now = this.time.now;
    if (now - this.player.lastAttackAt < w.cooldownMs) return;
    if (this.player.stamina < w.staminaCost) return;
    if (this.player.mana < w.manaCost) return;
    this.player.stamina -= w.staminaCost;
    this.player.mana -= w.manaCost;
    this.player.lastAttackAt = now;

    if (w.type === "melee") this.fireMelee(w);
    else this.fireProjectile(w);
  }

  private fireMelee(w: WeaponDef): void {
    const offsetX = this.player.facing * (w.reach / 2);
    this.attackHitbox
      .setSize(w.reach, w.swingHeight)
      .setPosition(this.player.x + offsetX, this.player.y)
      .setFillStyle(0xffe680, 0.5);
    const body = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    body.setSize(w.reach, w.swingHeight);
    body.enable = true;
    this.attackHitbox.setData("damage", w.damage);
    this.attackHitbox.setData("knockX", this.player.facing * w.knockX);
    this.attackHitbox.setData("knockY", w.knockY);
    body.updateFromGameObject();
    this.time.delayedCall(w.swingDurationMs, () => {
      this.attackHitbox.setFillStyle(0xffe680, 0);
      this.attackHitbox.body.enable = false;
    });
  }

  private fireProjectile(w: WeaponDef): void {
    const pointer = this.input.activePointer;
    const ox = this.player.x + this.player.facing * 6;
    const oy = this.player.y - 2;
    let dx = pointer.worldX - ox;
    let dy = pointer.worldY - oy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      dx = this.player.facing;
      dy = 0;
    } else {
      dx /= len;
      dy /= len;
    }
    this.playerProjectiles.spawn({
      x: ox,
      y: oy,
      vx: dx * w.projectileSpeed,
      vy: dy * w.projectileSpeed,
      damage: w.damage,
      texture: w.projectileTexture,
      range: w.projectileRange,
      rotation: Math.atan2(dy, dx),
      knockX: w.knockX,
      knockY: w.knockY,
      homingTurnRate: w.homingTurnRate,
      gravityAfterMs: w.projectileGravityAfterMs,
      piercing: w.piercing,
      glowTint: w.glowTint,
      glowFrequencyMs: w.glowFrequencyMs,
      glowLifespanMs: w.glowLifespanMs,
    });
    this.player.facing = dx >= 0 ? 1 : -1;
    this.player.setFlipX(this.player.facing === -1);
  }

  private updateWeaponVisual(now: number): void {
    if (!this.combatMode) {
      this.weaponVisual.setVisible(false);
      return;
    }
    const w = this.player.weapon;
    this.weaponVisual.setTexture(w.heldTexture);
    const swinging =
      w.type === "melee" && now - this.player.lastAttackAt < w.swingDurationMs;
    const tilt = swinging ? this.player.facing * 1.0 : this.player.facing * 0.25;
    this.weaponVisual
      .setPosition(this.player.x + this.player.facing * 9, this.player.y + 4)
      .setRotation(tilt)
      .setFlipX(this.player.facing === -1)
      .setVisible(true);
  }

  // -------- Hotbar --------

  private useHotbarSlot(slot: number): void {
    if (this.combatMode) this.castSkillInSlot(slot);
    else this.useItemInSlot(slot);
  }

  private useItemInSlot(slot: number): void {
    const stack = this.inventory.utility[slot];
    if (!stack) return;
    let consumed = false;
    switch (stack.itemId) {
      case "hp_potion":
        if (this.player.hp < PLAYER_MAX_HP) {
          this.player.hp = Math.min(PLAYER_MAX_HP, this.player.hp + HP_POTION_HEAL);
          this.flashPlayer(0x60d060, 180);
          consumed = true;
        }
        break;
      case "mp_potion":
        if (this.player.mana < MAX_MANA) {
          this.player.mana = Math.min(MAX_MANA, this.player.mana + MP_POTION_RESTORE);
          this.flashPlayer(0x6fb6ff, 180);
          consumed = true;
        }
        break;
    }
    if (consumed) {
      this.inventory.consumeUtility(slot);
      this.hotbarUI.flash(slot);
    }
  }

  private castSkillInSlot(slot: number): void {
    const ref = this.inventory.skill[slot];
    if (!ref) return;
    const skill = SKILLS[ref.skillId];
    if (!skill) return;
    const now = this.time.now;
    const cdUntil = this.skillCooldownUntil.get(skill.id) ?? 0;
    if (now < cdUntil) return;
    if (this.player.mana < skill.manaCost) return;
    this.player.mana -= skill.manaCost;
    this.skillCooldownUntil.set(skill.id, now + skill.cooldownMs);
    skill.cast(this.caster);
    this.hotbarUI.flash(slot);
  }

  private describeHotbarSlot(i: number): HotbarSlotDisplay {
    if (this.combatMode) {
      const ref = this.inventory.skill[i];
      if (!ref) {
        return { iconKey: null, count: null, cooldownPct: 1, cooldownSecondsLeft: 0, available: false };
      }
      const skill = SKILLS[ref.skillId];
      const cdUntil = this.skillCooldownUntil.get(skill.id) ?? 0;
      const remaining = Math.max(0, cdUntil - this.time.now);
      const pct = skill.cooldownMs > 0 ? 1 - remaining / skill.cooldownMs : 1;
      const ready = remaining <= 0 && this.player.mana >= skill.manaCost;
      return {
        iconKey: skill.iconKey,
        count: null,
        cooldownPct: Phaser.Math.Clamp(pct, 0, 1),
        cooldownSecondsLeft: remaining / 1000,
        available: ready,
      };
    }
    const stack = this.inventory.utility[i];
    if (!stack) {
      return { iconKey: null, count: null, cooldownPct: 1, cooldownSecondsLeft: 0, available: false };
    }
    const def = ITEMS[stack.itemId];
    return {
      iconKey: def.icon,
      count: stack.count,
      cooldownPct: 1,
      cooldownSecondsLeft: 0,
      available: stack.count > 0,
    };
  }

  private describeHotbarMode(): { text: string; color: string } {
    return this.combatMode
      ? { text: "Skill bar (battle mode)", color: "#ff8a5a" }
      : { text: "Utility bar (exploration)", color: "#6fd3ff" };
  }

  // -------- Damage handlers --------

  private onMeleeHit(enemySprite: Phaser.Physics.Arcade.Sprite): void {
    const enemy = enemySprite.getData("enemy") as Enemy | undefined;
    if (!enemy || !enemy.alive) return;
    const dmg = (this.attackHitbox.getData("damage") as number) ?? 0;
    const knockX = (this.attackHitbox.getData("knockX") as number) ?? 0;
    const knockY = (this.attackHitbox.getData("knockY") as number) ?? -120;
    enemy.takeDamage(dmg, knockX, knockY);
    this.spawnDamageNumber(enemy.sprite.x, enemy.sprite.y - 30, dmg, "#ffd060");
    if (!enemy.alive) this.spawnHitFlash(enemy.sprite.x, enemy.sprite.y);
  }

  private onPlayerProjectileHit(
    proj: Phaser.Physics.Arcade.Image,
    enemySprite: Phaser.Physics.Arcade.Sprite,
  ): void {
    if (!proj.active) return;
    const enemy = enemySprite.getData("enemy") as Enemy | undefined;
    if (!enemy || !enemy.alive) return;
    const piercing = proj.getData("piercing") as boolean;
    if (piercing) {
      const hitSet = proj.getData("hitSet") as Set<Enemy>;
      if (hitSet.has(enemy)) return;
      hitSet.add(enemy);
    } else {
      if (proj.getData("hit")) return;
      proj.setData("hit", true);
    }
    const dmg = (proj.getData("damage") as number) ?? 0;
    const knockX = (proj.getData("knockX") as number) ?? 0;
    const knockY = (proj.getData("knockY") as number) ?? -60;
    const vx = (proj.body as Phaser.Physics.Arcade.Body).velocity.x;
    enemy.takeDamage(dmg, Math.sign(vx) * knockX, knockY);
    this.spawnDamageNumber(enemy.sprite.x, enemy.sprite.y - 30, dmg, "#ffd060");
    if (!enemy.alive) this.spawnHitFlash(enemy.sprite.x, enemy.sprite.y);
    if (!piercing) this.playerProjectiles.markForDestroy(proj);
  }

  private onEnemyProjectileHit(proj: Phaser.Physics.Arcade.Image): void {
    if (!proj.active) return;
    if (proj.getData("hit")) return;
    proj.setData("hit", true);
    const dmg = (proj.getData("damage") as number) ?? 0;
    this.damagePlayer(dmg);
    this.enemyProjectiles.markForDestroy(proj);
  }

  private onPlayerTouchEnemy(enemySprite: Phaser.Physics.Arcade.Sprite): void {
    const enemy = enemySprite.getData("enemy") as Enemy | undefined;
    if (!enemy || !enemy.alive) return;
    const now = this.time.now;
    if (now - this.player.lastHurtAt < TOUCH_COOLDOWN_MS) return;
    this.damagePlayer(enemy.contactDamage);
    const dir = this.player.x < enemy.sprite.x ? -1 : 1;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(dir * 220, -220);
  }

  private damagePlayer(amount: number): void {
    if (this.time.now < this.player.invulnUntil) return;
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.player.lastHurtAt = this.time.now;
    this.player.setTint(0xff6f7a);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.cameras.main.shake(120, 0.005);
    this.spawnDamageNumber(this.player.x, this.player.y - 24, amount, "#ff7070");
    if (this.player.hp <= 0) this.handlePlayerDeath();
  }

  private handlePlayerDeath(): void {
    this.player.setActive(false).setVisible(false);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.weaponVisual.setVisible(false);
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height / 2, "YOU DIED\npress R to restart", {
        fontFamily: "monospace",
        fontSize: "28px",
        align: "center",
        color: "#ff8a8a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000);
    this.input.keyboard!.once("keydown-R", () => this.scene.restart());
  }

  // -------- Skill caster --------

  private buildSkillCaster(): SkillCaster {
    return {
      player: () => ({ x: this.player.x, y: this.player.y, facing: this.player.facing }),
      cursor: () => ({
        x: this.input.activePointer.worldX,
        y: this.input.activePointer.worldY,
      }),
      healPlayer: (amount) => {
        this.player.hp = Math.min(PLAYER_MAX_HP, this.player.hp + amount);
      },
      restoreMana: (amount) => {
        this.player.mana = Math.min(MAX_MANA, this.player.mana + amount);
      },
      restoreStamina: (amount) => {
        this.player.stamina = Math.min(MAX_STAMINA, this.player.stamina + amount);
      },
      blinkPlayer: (distance) => {
        const dx = this.player.facing * distance;
        const target = Phaser.Math.Clamp(this.player.x + dx, 16, WORLD_WIDTH - 16);
        this.player.setX(target);
        this.spawnDashTrail();
      },
      applyInvulnFor: (ms) => {
        this.player.invulnUntil = Math.max(this.player.invulnUntil, this.time.now + ms);
      },
      spawnPlayerProjectile: (cfg) => this.playerProjectiles.spawn(cfg),
      flashPlayer: (color, ms) => this.flashPlayer(color, ms),
    };
  }

  private flashPlayer(color: number, ms: number): void {
    this.player.setTint(color);
    this.time.delayedCall(ms, () => this.player.clearTint());
  }

  // -------- Inventory seeding --------

  private seedInventory(): void {
    this.inventory.addItem("utility", "hp_potion", 5, ITEMS.hp_potion.maxStack);
    this.inventory.addItem("utility", "mp_potion", 5, ITEMS.mp_potion.maxStack);
    this.inventory.setSkill(0, { skillId: "fireball" });
    this.inventory.setSkill(1, { skillId: "heal" });
    this.inventory.setSkill(2, { skillId: "surge" });
    this.inventory.setSkill(3, { skillId: "blink" });
  }

  // -------- Spawns / world --------

  private spawnPlayer(x: number, y: number): PlayerSprite {
    const s = this.physics.add.sprite(x, y, "px-player") as PlayerSprite;
    s.setCollideWorldBounds(true);
    s.setMaxVelocity(DASH_SPEED, 900);
    s.hp = PLAYER_MAX_HP;
    s.stamina = MAX_STAMINA;
    s.mana = MAX_MANA;
    s.facing = 1;
    s.lastAttackAt = -Infinity;
    s.lastHurtAt = -Infinity;
    s.invulnUntil = 0;
    s.dashUntil = 0;
    s.dashDir = 1;
    s.dropThroughUntil = 0;
    s.weapon = WEAPONS.wooden_sword;
    (s.body as Phaser.Physics.Arcade.Body).setSize(14, 26).setOffset(2, 1);
    return s;
  }

  private buildLevel(): void {
    for (let x = 0; x < WORLD_WIDTH; x += 64) {
      const g = this.solidPlatforms.create(
        x + 32,
        GROUND_Y + 8,
        "px-ground",
      ) as Phaser.Physics.Arcade.Image;
      g.refreshBody();
    }
    const platSpots: Array<[number, number]> = [
      [320, 380],
      [560, 320],
      [820, 320],
      [1180, 300],
      [1420, 340],
      [1720, 320],
      [2020, 300],
      [2260, 240],
      [2520, 350],
    ];
    for (const [px, py] of platSpots) {
      const p = this.oneWayPlatforms.create(
        px,
        py,
        "px-platform",
      ) as OneWayPlatform;
      p.refreshBody();
    }
  }

  private drawParallaxBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(0x141728, 1);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    g.fillStyle(0x1d2238, 1);
    for (let i = 0; i < 18; i++) {
      const bx = (i * 173) % WORLD_WIDTH;
      const bh = 80 + ((i * 53) % 90);
      g.fillRect(bx, GROUND_Y - bh, 120, bh);
    }
    g.fillStyle(0xffffff, 0.5);
    for (let i = 0; i < 60; i++) {
      const sx = (i * 97) % WORLD_WIDTH;
      const sy = (i * 41) % (GROUND_Y - 120);
      g.fillRect(sx, sy, 2, 2);
    }
  }

  // -------- HUD --------

  private buildHud(): void {
    this.hudBars = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.hpText = this.add
      .text(12, 12, "", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(1001);
    this.mpText = this.add
      .text(12, 30, "", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(1001);
    this.staText = this.add
      .text(12, 48, "", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(1001);

    this.modeText = this.add
      .text(this.scale.width / 2, 14, "EXPLORATION MODE", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#6fd3ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.weaponIcon = this.add
      .image(this.scale.width - 20, 22, "wpn-wooden-sword")
      .setOrigin(1, 0)
      .setScale(1.2)
      .setScrollFactor(0)
      .setDepth(1001);
    this.weaponPanel = this.add
      .text(this.scale.width - 50, 12, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#cfd6e6",
        align: "right",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.weaponVisual = this.add
      .image(0, 0, "wpn-wooden-sword")
      .setOrigin(0.4, 0.7)
      .setVisible(false)
      .setDepth(this.player.depth + 1);
  }

  private drawHud(): void {
    const g = this.hudBars;
    g.clear();
    this.drawBar(g, 80, 14, 130, 9, this.player.hp / PLAYER_MAX_HP, 0xe04050);
    this.drawBar(g, 80, 32, 130, 9, this.player.mana / MAX_MANA, 0x6fb6ff);
    this.drawBar(g, 80, 50, 130, 9, this.player.stamina / MAX_STAMINA, 0xf4d35e);
    this.hpText.setText(`HP  ${Math.ceil(this.player.hp).toString().padStart(3)}`);
    this.mpText.setText(`MP  ${Math.ceil(this.player.mana).toString().padStart(3)}`);
    this.staText.setText(`STA ${Math.ceil(this.player.stamina).toString().padStart(3)}`);
  }

  private drawBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    pct: number,
    color: number,
  ): void {
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(0x2a2f44, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(color, 1);
    g.fillRect(x, y, Math.floor(w * Math.max(0, Math.min(1, pct))), h);
  }

  // -------- VFX / helpers --------

  private spawnHitFlash(x: number, y: number): void {
    const flash = this.add.circle(x, y, 14, 0xffe680, 0.9);
    this.tweens.add({
      targets: flash,
      radius: 28,
      alpha: 0,
      duration: 220,
      onComplete: () => flash.destroy(),
    });
  }

  private spawnDashTrail(): void {
    const ghost = this.add
      .rectangle(this.player.x, this.player.y, 18, 28, 0x6fd3ff, 0.5)
      .setDepth(this.player.depth - 1);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 200,
      onComplete: () => ghost.destroy(),
    });
  }

  private spawnDamageNumber(
    x: number,
    y: number,
    damage: number,
    color: string,
  ): void {
    const txt = this.add
      .text(x, y, String(damage), {
        fontFamily: "monospace",
        fontSize: "14px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(2500);
    this.tweens.add({
      targets: txt,
      y: y - 42,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  private makePixelTexture(
    key: string,
    w: number,
    h: number,
    fill: number,
    outline: number,
  ): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(outline, 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(fill, 1);
    g.fillRect(1, 1, w - 2, h - 2);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeOrb(key: string, color: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    g.fillCircle(7, 7, 6);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(6, 6, 2);
    g.generateTexture(key, 14, 14);
    g.destroy();
  }
}
