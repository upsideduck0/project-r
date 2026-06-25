import Phaser from "phaser";
import {
  WEAPONS,
  WeaponDef,
  buildWeaponTextures,
  computeWeaponDamage,
  meetsWeaponRequirements,
  weaponRequirementFailReason,
  weaponCooldownMs,
} from "../data/weapons";
import { ProjectileSpawnConfig, ProjectileSystem } from "../systems/Projectiles";
import {
  ITEMS,
  buildItemIcons,
} from "../data/items";
import { Inventory } from "../systems/Inventory";
import { tackleDamage } from "../systems/combat";
import {
  SKILLS,
  SkillCaster,
  buildSkillIcons,
  executeSkill,
  meetsRequirements,
} from "../data/skills";
import { HotbarUI, HotbarSlotDisplay } from "../ui/HotbarUI";
import { Enemy, EnemyAbilityContext } from "../entities/Enemy";
import { Dummy } from "../entities/Dummy";
import { MeleeChaser } from "../entities/MeleeChaser";
import { RangedEnemy } from "../entities/RangedEnemy";
import { TankEnemy } from "../entities/TankEnemy";
import { FighterEnemy } from "../entities/FighterEnemy";
import { ThiefEnemy } from "../entities/ThiefEnemy";
import { CommanderEnemy } from "../entities/CommanderEnemy";
import { ArcherEnemy } from "../entities/ArcherEnemy";
import { DevConsole } from "../ui/DevConsole";
import { StatBlock } from "../systems/stats/StatBlock";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const GROUND_Y = 480;
const WALL_THICKNESS = 16;

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
  private devConsole!: DevConsole;
  private playerStats!: StatBlock;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.makePixelTexture("px-player", 18, 28, 0x6fd3ff, 0x254a5a);
    this.makePixelTexture("px-dummy", 22, 30, 0xb89070, 0x5a4530);
    this.makePixelTexture("px-chaser", 20, 28, 0xe05050, 0x5a2020);
    this.makePixelTexture("px-ranged", 18, 28, 0x9070ff, 0x3a2580);
    this.makePixelTexture("px-tank", 28, 36, 0x707080, 0x202028);
    this.makePixelTexture("px-fighter", 22, 32, 0xe0a040, 0x603a10);
    this.makePixelTexture("px-thief", 16, 26, 0x60d090, 0x205040);
    this.makePixelTexture("px-commander", 24, 34, 0x506fff, 0x18255a);
    this.makePixelTexture("px-archer", 18, 28, 0x40c0a0, 0x14503f);
    this.makePixelTexture("px-ground", 64, 16, 0x3a3f55, 0x1c1f2b);
    this.makePixelTexture("px-wall", 16, 64, 0x3a3f55, 0x1c1f2b);
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
    this.enemyEntities = [];
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

    // Character stat framework for the player. Per the current spec the
    // player starts at 0 across the board — every attribute, every main and
    // sub stat. Authored mode skips the attribute-derive table so the zeros
    // pass straight through.
    this.playerStats = new StatBlock({
      attributes: { VIT: 0, MIG: 0, AGI: 0, INT: 0, INS: 0, PRE: 0 },
      mainStatMode: "authored",
      subStatMode: "authored",
    });

    this.buildHud();
    this.hotbarUI = new HotbarUI(
      this,
      (i) => this.describeHotbarSlot(i),
      () => this.describeHotbarMode(),
    );

    this.setWeapon("wooden_sword");

    this.devConsole = new DevConsole();
    this.registerDevCommands();
    const kb = this.input.keyboard!;
    this.devConsole.onOpen = () => {
      kb.enabled = false;
      kb.resetKeys();
    };
    this.devConsole.onClose = () => {
      kb.enabled = true;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.devConsole.destroy();
    });
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
      if (left && !right) body.setVelocityX(-PLAYER_SPEED);
      else if (right && !left) body.setVelocityX(PLAYER_SPEED);
      else body.setVelocityX(0);
    } else {
      body.setVelocityX(DASH_SPEED * this.player.dashDir);
    }
    body.setAllowGravity(!dashing);
    if (dashing) body.setVelocityY(0);

    // Always face the cursor, in any mode. Small deadzone avoids jitter
    // when the pointer sits right on top of the player.
    const pointer = this.input.activePointer;
    const dxToCursor = pointer.worldX - this.player.x;
    if (Math.abs(dxToCursor) > 4) {
      this.player.facing = dxToCursor < 0 ? -1 : 1;
      this.player.setFlipX(this.player.facing === -1);
    }

    if (this.attackHitbox.body.enable) {
      const offsetX = this.player.facing * (this.player.weapon.range / 2);
      this.attackHitbox.setPosition(this.player.x + offsetX, this.player.y);
      (this.attackHitbox.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
    }

    const playerView = {
      x: this.player.x,
      y: this.player.y,
      facing: this.player.facing,
      alive: this.player.active,
      vit: this.playerStats.getAttributes().VIT,
      def: this.playerStats.getMain("DEF"),
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
    // NOTE: When Phaser arcade overlap is called with (group, single), it
    // normalizes to (single, group) internally, so the callback ends up
    // receiving (single, child). Passing (single, group) explicitly here
    // keeps the callback args unambiguous.
    this.physics.add.overlap(
      this.player,
      this.enemyProjectiles.getGroup(),
      (_player, proj) =>
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

  // Every spawnable enemy kind lives in one factory so the default room and
  // the /spawn console command stay in sync. Returns null for unknown kinds.
  private createEnemyByKind(kind: string, x: number, y: number): Enemy | null {
    switch (kind) {
      case "dummy":
        return new Dummy(this, x, y);
      case "chaser":
        return new MeleeChaser(this, x, y);
      case "fighter":
        return new FighterEnemy(this, x, y);
      case "tank":
        return new TankEnemy(this, x, y);
      case "thief":
        return new ThiefEnemy(this, x, y);
      case "caster":
      case "ranged":
        return new RangedEnemy(this, x, y);
      case "archer":
        return new ArcherEnemy(this, x, y);
      case "commander":
        return new CommanderEnemy(this, x, y);
      default:
        return null;
    }
  }

  private registerEnemy(e: Enemy): void {
    this.enemyEntities.push(e);
    this.enemies.add(e.sprite);
    e.setAbilityContext(this.buildEnemyAbilityContext(e));
  }

  // Grants an enemy the world capabilities its skills need. Generic — every
  // enemy gets the same surface; the enemy decides what to do with it.
  private buildEnemyAbilityContext(self: Enemy): EnemyAbilityContext {
    return {
      target: () => ({
        x: this.player.x,
        y: this.player.y,
        facing: this.player.facing,
        alive: this.player.active,
        vit: this.playerStats.getAttributes().VIT,
        def: this.playerStats.getMain("DEF"),
      }),
      allies: () => this.enemyEntities.filter((e) => e !== self && e.alive),
      platformTops: () => this.platformTops(),
      worldMinX: 24,
      worldMaxX: WORLD_WIDTH - 24,
      spawnProjectile: (cfg) => this.enemyProjectiles.spawn(cfg),
      summon: (kind, sx, sy) => {
        const e = this.createEnemyByKind(kind, sx, sy);
        if (e) this.registerEnemy(e);
        return e;
      },
      damagePlayerInRange: (range, dmg, knockX, knockY) => {
        if (dmg <= 0) return;
        const d = Phaser.Math.Distance.Between(
          self.sprite.x, self.sprite.y, this.player.x, this.player.y,
        );
        if (d > range) return;
        this.damagePlayer(dmg);
        const dir = this.player.x < self.sprite.x ? -1 : 1;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(dir * knockX, knockY);
      },
    };
  }

  private platformTops(): { x: number; y: number }[] {
    const tops: { x: number; y: number }[] = [];
    this.oneWayPlatforms.children.iterate((obj) => {
      const p = obj as OneWayPlatform;
      tops.push({ x: p.x, y: p.y - p.displayHeight / 2 - 20 });
      return true;
    });
    return tops;
  }

  private spawnEnemies(): void {
    // Default test room: tank (front), thief, fighter, caster (on a platform),
    // commander — five enemies.
    const tops = this.platformTops();
    const casterPlat = tops.length > 0 ? tops[tops.length - 1] : { x: 740, y: 340 };
    const ground: Array<[string, number]> = [
      ["tank", 280],
      ["thief", 470],
      ["fighter", 650],
      ["commander", 850],
    ];
    for (const [kind, x] of ground) {
      const e = this.createEnemyByKind(kind, x, GROUND_Y - 60);
      if (e) this.registerEnemy(e);
    }
    const caster = this.createEnemyByKind("caster", casterPlat.x, casterPlat.y);
    if (caster) this.registerEnemy(caster);
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
      lines.push(`${sel} ${keys[i]}: ${w.name} (${w.baseDamage} dmg${sta}${mp})`);
    }
    this.weaponPanel.setText(lines.join("\n"));
  }

  private fireWeapon(): void {
    const w = this.player.weapon;
    const now = this.time.now;
    const cd = weaponCooldownMs(w);
    if (now - this.player.lastAttackAt < cd) return;
    if (this.player.stamina < w.staminaCost) return;
    if (this.player.mana < w.manaCost) return;
    const reqFail = weaponRequirementFailReason(w, this.playerStats.getAttributes());
    if (reqFail !== null) {
      this.spawnReqFailToast(reqFail);
      return;
    }
    this.player.stamina -= w.staminaCost;
    this.player.mana -= w.manaCost;
    this.player.lastAttackAt = now;

    if (w.type === "melee") this.fireMelee(w);
    else this.fireProjectile(w);
  }

  private computePlayerWeaponDamage(w: WeaponDef): number {
    return computeWeaponDamage(w, this.playerStats.getAttributes());
  }

  private fireMelee(w: WeaponDef): void {
    const offsetX = this.player.facing * (w.range / 2);
    this.attackHitbox
      .setSize(w.range, w.swingHeight)
      .setPosition(this.player.x + offsetX, this.player.y)
      .setFillStyle(0xffe680, 0.5);
    const body = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    body.setSize(w.range, w.swingHeight);
    body.enable = true;
    this.attackHitbox.setData("damage", this.computePlayerWeaponDamage(w));
    this.attackHitbox.setData("knockX", this.player.facing * w.knockback.x);
    this.attackHitbox.setData("knockY", w.knockback.y);
    // Fresh per-swing hit set so each enemy only takes one tick of damage
    // during a single swing, even while overlapping the hitbox for several
    // frames.
    this.attackHitbox.setData("hitSet", new Set<Enemy>());
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
      damage: this.computePlayerWeaponDamage(w),
      texture: w.projectileTexture,
      range: w.range,
      rotation: Math.atan2(dy, dx),
      knockX: w.knockback.x,
      knockY: w.knockback.y,
      homingTurnRate: w.homingTurnRate,
      gravityAfterMs: w.projectileGravityAfterMs,
      piercing: w.piercing,
      glowTint: w.glowTint,
      glowFrequencyMs: w.glowFrequencyMs,
      glowLifespanMs: w.glowLifespanMs,
    });
  }

  private updateWeaponVisual(now: number): void {
    if (!this.combatMode) {
      this.weaponVisual.setVisible(false);
      return;
    }
    const w = this.player.weapon;
    const facing = this.player.facing;
    this.weaponVisual.setTexture(w.heldTexture);
    const isSword = w.id === "wooden_sword";
    const scale = isSword ? 2 : 1;
    this.weaponVisual.setScale(scale);

    const elapsed = now - this.player.lastAttackAt;
    const swinging = w.type === "melee" && elapsed < w.swingDurationMs;

    let rot: number;
    let ox: number;
    let oy: number;
    if (isSword && swinging) {
      // Five discrete swing keyframes: high windup -> cocked -> strike ->
      // follow-through -> recovery. Snapped (no tweening) so the swing
      // reads as a flipbook rather than a tween.
      const t = elapsed / w.swingDurationMs;
      const frame = Math.min(4, Math.floor(t * 5));
      const SWING_FRAMES: Array<{ rot: number; ox: number; oy: number }> = [
        { rot: -1.7, ox: -2, oy: -16 },
        { rot: -0.9, ox: 10, oy: -10 },
        { rot: 0.2, ox: 22, oy: -2 },
        { rot: 1.1, ox: 20, oy: 8 },
        { rot: 1.7, ox: 12, oy: 16 },
      ];
      const f = SWING_FRAMES[frame];
      rot = facing * f.rot;
      ox = facing * f.ox;
      oy = f.oy;
    } else if (isSword) {
      // Idle hold for the (now larger) sword.
      rot = facing * 0.25;
      ox = facing * 14;
      oy = 6;
    } else {
      // Bow / staff resting hold.
      rot = facing * 0.25;
      ox = facing * 9;
      oy = 4;
    }

    this.weaponVisual
      .setPosition(this.player.x + ox, this.player.y + oy)
      .setRotation(rot)
      .setFlipX(facing === -1)
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
    const core = skill.core;
    const now = this.time.now;
    const cdUntil = this.skillCooldownUntil.get(core.id) ?? 0;
    if (now < cdUntil) return;
    if (this.player.mana < core.manaCost) return;
    if (!meetsRequirements(core.requirements, this.playerStats.getAttributes()))
      return;
    this.player.mana -= core.manaCost;
    this.skillCooldownUntil.set(core.id, now + core.cooldownMs);
    // Damage runs through the centralized formula. The context is neutral for
    // now (no rebalance); pass the player's stats here to enable scaling.
    executeSkill(skill, this.caster, { damage: {} });
    this.hotbarUI.flash(slot);
  }

  private describeHotbarSlot(i: number): HotbarSlotDisplay {
    if (this.combatMode) {
      const ref = this.inventory.skill[i];
      if (!ref) {
        return { iconKey: null, count: null, cooldownPct: 1, cooldownSecondsLeft: 0, available: false };
      }
      const core = SKILLS[ref.skillId].core;
      const cdUntil = this.skillCooldownUntil.get(core.id) ?? 0;
      const remaining = Math.max(0, cdUntil - this.time.now);
      const pct = core.cooldownMs > 0 ? 1 - remaining / core.cooldownMs : 1;
      const ready = remaining <= 0 && this.player.mana >= core.manaCost;
      return {
        iconKey: core.icon,
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

  // -------- Dev console commands --------

  private static readonly SPAWNABLE_KINDS =
    "tank|fighter|thief|commander|chaser|caster|archer|dummy";

  private registerDevCommands(): void {
    this.devConsole.register("spawn", (args) => this.cmdSpawn(args));
    this.devConsole.register("give", (args) => this.cmdGive(args));
    this.devConsole.register("fh", () => this.cmdFullHeal());
    this.devConsole.register("stats", (args) => this.cmdStats(args));
  }

  private cmdSpawn(args: string[]): string {
    const kind = (args[0] ?? "").toLowerCase();
    if (!kind) return `[DEV] usage: /spawn <${GameScene.SPAWNABLE_KINDS}>`;
    const px = Phaser.Math.Clamp(
      this.player.x + this.player.facing * 90,
      40,
      WORLD_WIDTH - 40,
    );
    const py = GROUND_Y - 60;
    const enemy = this.createEnemyByKind(kind, px, py);
    if (!enemy) {
      return `[DEV] unknown enemy: ${kind} (try ${GameScene.SPAWNABLE_KINDS})`;
    }
    this.registerEnemy(enemy);
    return `[DEV] spawned ${kind} at (${Math.round(px)}, ${Math.round(py)})`;
  }

  private cmdGive(args: string[]): string {
    const id = args[0];
    if (!id) return "[DEV] usage: /give <itemId>";
    if (SKILLS[id]) {
      const slot = this.findFreeSkillSlot();
      this.inventory.setSkill(slot, { skillId: id });
      return `[DEV] bound skill '${id}' to slot ${slot + 1}`;
    }
    if (ITEMS[id]) {
      const def = ITEMS[id];
      const leftover = this.inventory.addItem("utility", id, 1, def.maxStack);
      if (leftover > 0) return `[DEV] no room for ${id} (utility bar full)`;
      return `[DEV] added ${id} to utility bar`;
    }
    return `[DEV] unknown item or skill: ${id}`;
  }

  private cmdFullHeal(): string {
    this.player.hp = PLAYER_MAX_HP;
    this.player.mana = MAX_MANA;
    this.player.stamina = MAX_STAMINA;
    return "[DEV] HP, MP, and STA restored.";
  }

  // /stats           -> dump the player's stat block
  // /stats <kind>    -> dump the first living enemy of that kind
  private cmdStats(args: string[]): string {
    const target = (args[0] ?? "player").toLowerCase();
    if (target === "player" || target === "p") {
      return "[DEV] PLAYER stats\n" + this.playerStats.debugString();
    }
    const mx = this.input.activePointer.worldX;
    const my = this.input.activePointer.worldY;
    const candidates = this.enemyEntities.filter((e) => e.alive && e.kind === target);
    if (candidates.length === 0) return `[DEV] no living enemy of kind '${target}'`;
    const enemy = candidates.reduce((best, e) => {
      const d = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, mx, my);
      const bd = Phaser.Math.Distance.Between(best.sprite.x, best.sprite.y, mx, my);
      return d < bd ? e : best;
    });
    return `[DEV] ${target.toUpperCase()} stats\n` + enemy.stats.debugString();
  }

  private findFreeSkillSlot(): number {
    for (let i = 0; i < this.inventory.skill.length; i++) {
      if (!this.inventory.skill[i]) return i;
    }
    return 0;
  }

  // -------- Damage handlers --------

  private onMeleeHit(enemySprite: Phaser.Physics.Arcade.Sprite): void {
    const enemy = enemySprite.getData("enemy") as Enemy | undefined;
    if (!enemy || !enemy.alive) return;
    const hitSet = this.attackHitbox.getData("hitSet") as Set<Enemy> | undefined;
    if (hitSet) {
      if (hitSet.has(enemy)) return;
      hitSet.add(enemy);
    }
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
    const playerAttrs = this.playerStats.getAttributes();
    const playerDef = this.playerStats.getMain("DEF");
    const enemyAttrs = enemy.stats.getAttributes();
    const enemyDef = enemy.stats.getMain("DEF");
    const dmg = enemy.tryAttackPlayer(this.time.now, {
      vit: playerAttrs.VIT,
      def: playerDef,
    });
    if (dmg === null) return;
    if (dmg > 0) this.damagePlayer(dmg);
    // Player's reciprocal tackle on the enemy (no cooldown gating beyond
    // the natural contact rate from physics overlap).
    const tackleBack = tackleDamage(playerAttrs.VIT, enemyAttrs.VIT, enemyDef);
    if (tackleBack > 0) {
      const dir = enemy.sprite.x < this.player.x ? -1 : 1;
      enemy.takeDamage(tackleBack, dir * 80, -60);
    }
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
      self: () => ({ x: this.player.x, y: this.player.y, facing: this.player.facing }),
      aimPoint: () => ({
        x: this.input.activePointer.worldX,
        y: this.input.activePointer.worldY,
      }),
      heal: (amount) => {
        this.player.hp = Math.min(PLAYER_MAX_HP, this.player.hp + amount);
      },
      restoreMana: (amount) => {
        this.player.mana = Math.min(MAX_MANA, this.player.mana + amount);
      },
      restoreStamina: (amount) => {
        this.player.stamina = Math.min(MAX_STAMINA, this.player.stamina + amount);
      },
      spawnProjectile: (cfg) => this.playerProjectiles.spawn(cfg),
      // Player only relocates in its facing direction (Blink).
      dash: (distance) => {
        const dx = this.player.facing * distance;
        const target = Phaser.Math.Clamp(this.player.x + dx, 16, WORLD_WIDTH - 16);
        this.player.setX(target);
        this.spawnDashTrail();
      },
      applyInvuln: (ms) => {
        this.player.invulnUntil = Math.max(this.player.invulnUntil, this.time.now + ms);
      },
      flash: (color, ms) => this.flashPlayer(color, ms),
      castVisual: (color, radius) => this.spawnCastVisual(this.player.x, this.player.y, color, radius),
    };
  }

  private flashPlayer(color: number, ms: number): void {
    this.player.setTint(color);
    this.time.delayedCall(ms, () => this.player.clearTint());
  }

  // Attribute-identity flourish on cast: an expanding colored ring.
  private spawnCastVisual(x: number, y: number, color: number, radius: number): void {
    const ring = this.add
      .circle(x, y, Math.max(12, radius * 0.4), color, 0.3)
      .setStrokeStyle(3, color, 0.9)
      .setDepth(this.player.depth + 2);
    this.tweens.add({
      targets: ring,
      radius: Math.max(18, radius),
      alpha: 0,
      duration: 300,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
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
    s.setDepth(12); // above enemies (10) and buff halos (5).
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
    // Floor
    for (let x = 0; x < WORLD_WIDTH; x += 64) {
      const g = this.solidPlatforms.create(
        x + 32,
        GROUND_Y + 8,
        "px-ground",
      ) as Phaser.Physics.Arcade.Image;
      g.refreshBody();
    }
    // Ceiling
    for (let x = 0; x < WORLD_WIDTH; x += 64) {
      const c = this.solidPlatforms.create(
        x + 32,
        WALL_THICKNESS / 2,
        "px-ground",
      ) as Phaser.Physics.Arcade.Image;
      c.refreshBody();
    }
    // Left + right walls (interior of the room)
    for (let y = WALL_THICKNESS; y < GROUND_Y; y += 64) {
      const lw = this.solidPlatforms.create(
        WALL_THICKNESS / 2,
        y + 32,
        "px-wall",
      ) as Phaser.Physics.Arcade.Image;
      lw.refreshBody();
      const rw = this.solidPlatforms.create(
        WORLD_WIDTH - WALL_THICKNESS / 2,
        y + 32,
        "px-wall",
      ) as Phaser.Physics.Arcade.Image;
      rw.refreshBody();
    }
    // Three in-air one-way platforms
    const platSpots: Array<[number, number]> = [
      [220, 380],
      [480, 300],
      [740, 380],
    ];
    for (const [px, py] of platSpots) {
      const p = this.oneWayPlatforms.create(
        px,
        py,
        "px-platform",
      ) as OneWayPlatform;
      p.refreshBody();
    }
    // Environment sits at depth -50: above the background, below characters
    // and their buff halos (which are at 5).
    this.solidPlatforms.children.iterate((obj) => {
      (obj as Phaser.GameObjects.Image).setDepth(-50);
      return true;
    });
    this.oneWayPlatforms.children.iterate((obj) => {
      (obj as Phaser.GameObjects.Image).setDepth(-50);
      return true;
    });
  }

  private drawParallaxBackground(): void {
    // Far back in the draw order so platforms, characters, and UI all sit on
    // top of it. Centralized depth scheme:
    //   background     -1000
    //   environment      -50 (platforms / walls)
    //   buff halos         5
    //   characters        10–13 (enemies 10, player 12, weapon 13)
    //   cast/aura rings   20–40
    //   hp bars          900
    //   hud / damage    1000+
    const g = this.add.graphics().setDepth(-1000);
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

  private reqFailToastUntil = -Infinity;

  private spawnReqFailToast(message: string): void {
    const now = this.time.now;
    if (now < this.reqFailToastUntil) return;
    this.reqFailToastUntil = now + 1200;
    const x = this.player.x;
    const y = this.player.y - 40;
    const txt = this.add
      .text(x, y, message, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ff9940",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(2500);
    this.tweens.add({
      targets: txt,
      y: y - 32,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => txt.destroy(),
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
