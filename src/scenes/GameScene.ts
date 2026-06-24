import Phaser from "phaser";
import { WEAPONS, WeaponDef, buildWeaponTextures } from "../data/weapons";
import { ProjectileSystem } from "../systems/Projectiles";

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

const DUMMY_MAX_HP = 80;
const DUMMY_TOUCH_DAMAGE = 5;
const DUMMY_TOUCH_COOLDOWN_MS = 1100;
const DUMMY_RESPAWN_DELAY_MS = 3500;

type PlayerSprite = Phaser.Physics.Arcade.Sprite & {
  hp: number;
  stamina: number;
  mana: number;
  facing: 1 | -1;
  lastAttackAt: number;
  lastHurtAt: number;
  dashUntil: number;
  dashDir: 1 | -1;
  dropThroughUntil: number;
  weapon: WeaponDef;
};

type DummyEnemy = Phaser.Physics.Arcade.Sprite & {
  hp: number;
  maxHp: number;
  spawnX: number;
  spawnY: number;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
};

type OneWayPlatform = Phaser.Physics.Arcade.Image;

export class GameScene extends Phaser.Scene {
  private player!: PlayerSprite;
  private dummies!: Phaser.Physics.Arcade.Group;
  private solidPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private oneWayPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private attackHitbox!: Phaser.GameObjects.Rectangle & {
    body: Phaser.Physics.Arcade.Body;
  };
  private projectiles!: ProjectileSystem;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyQ!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private weaponKeys: Phaser.Input.Keyboard.Key[] = [];

  private hudBars!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private staText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
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
    this.makePixelTexture("px-ground", 64, 16, 0x3a3f55, 0x1c1f2b);
    this.makePixelTexture("px-platform", 96, 12, 0x4a5072, 0x252a3d);
    buildWeaponTextures(this);
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.drawParallaxBackground();
    this.solidPlatforms = this.physics.add.staticGroup();
    this.oneWayPlatforms = this.physics.add.staticGroup();
    this.buildLevel();

    this.player = this.spawnPlayer(80, GROUND_Y - 60);
    this.dummies = this.physics.add.group();
    this.spawnDummy(400, GROUND_Y - 60);
    this.spawnDummy(820, 280);
    this.spawnDummy(1500, GROUND_Y - 60);
    this.spawnDummy(2200, GROUND_Y - 60);

    this.attackHitbox = this.add.rectangle(0, 0, 36, 24, 0xffe680, 0) as
      Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    this.physics.add.existing(this.attackHitbox);
    this.attackHitbox.body.setAllowGravity(false);
    this.attackHitbox.body.enable = false;

    this.projectiles = new ProjectileSystem(this);

    this.physics.add.collider(this.player, this.solidPlatforms);
    this.physics.add.collider(this.dummies, this.solidPlatforms);
    this.physics.add.collider(
      this.player,
      this.oneWayPlatforms,
      undefined,
      (_p, plat) => this.shouldCollideOneWay(plat as OneWayPlatform),
      this,
    );
    this.physics.add.collider(this.dummies, this.oneWayPlatforms);
    this.physics.add.overlap(
      this.player,
      this.dummies,
      (_p, d) => this.onPlayerTouchDummy(d as DummyEnemy),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.attackHitbox,
      this.dummies,
      (_hb, d) => this.onMeleeHit(d as DummyEnemy),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.projectiles.getGroup(),
      this.dummies,
      (proj, d) =>
        this.onProjectileHit(
          proj as Phaser.Physics.Arcade.Image,
          d as DummyEnemy,
        ),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.projectiles.getGroup(),
      this.solidPlatforms,
      (proj) =>
        this.projectiles.markForDestroy(
          proj as Phaser.Physics.Arcade.Image,
        ),
      undefined,
      this,
    );

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
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 2) this.toggleCombatMode();
      else if (pointer.button === 0) this.onLeftClick();
    });

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(120, 80);

    this.buildHud();
    this.setWeapon("wooden_sword");
  }

  update(_time: number, delta: number): void {
    if (!this.player.active) return;
    const now = this.time.now;
    const dt = delta / 1000;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // Inputs first so dash/jump state is fresh for the rest of update().
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

    this.dummies.children.iterate((obj) => {
      const d = obj as DummyEnemy;
      if (!d.active) return true;
      d.hpBg.setPosition(d.x, d.y - 22);
      d.hpFill.setPosition(d.x - 16, d.y - 22);
      d.hpFill.width = 32 * (d.hp / d.maxHp);
      return true;
    });

    this.updateWeaponVisual(now);
    this.projectiles.update(dt);

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
  }

  // ---------------- Movement ----------------

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
    const now = this.time.now;
    this.player.dashUntil = now + DASH_DURATION_MS;
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
      if (
        dy > 8 &&
        dy < 140 &&
        Math.abs(p.x - px) < p.displayWidth / 2 + 40
      ) {
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

  // ---------------- Combat mode ----------------

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
    // else: exploration left-click is reserved for environment interaction
  }

  // ---------------- Weapons ----------------

  private setWeapon(id: string): void {
    const w = WEAPONS[id];
    if (!w) return;
    this.player.weapon = w;
    this.weaponIcon.setTexture(w.heldTexture);
    this.refreshWeaponPanel();
  }

  private refreshWeaponPanel(): void {
    const lines: string[] = [];
    for (const id of ["wooden_sword", "wooden_bow", "wooden_staff"]) {
      const w = WEAPONS[id];
      const num = id === "wooden_sword" ? "1" : id === "wooden_bow" ? "2" : "3";
      const sel = this.player.weapon.id === id ? ">" : " ";
      const sta = w.staminaCost ? ` ${w.staminaCost}sta` : "";
      const mp = w.manaCost ? ` ${w.manaCost}mp` : "";
      lines.push(`${sel} ${num}: ${w.name} (${w.damage} dmg${sta}${mp})`);
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
    this.projectiles.spawn({
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
      glowTint: w.glowTint,
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
      w.type === "melee" &&
      now - this.player.lastAttackAt < w.swingDurationMs;
    const tilt = swinging
      ? this.player.facing * 1.0
      : this.player.facing * 0.25;
    this.weaponVisual
      .setPosition(this.player.x + this.player.facing * 9, this.player.y + 4)
      .setRotation(tilt)
      .setFlipX(this.player.facing === -1)
      .setVisible(true);
  }

  // ---------------- Damage ----------------

  private onMeleeHit(dummy: DummyEnemy): void {
    if (!dummy.active) return;
    const dmg = (this.attackHitbox.getData("damage") as number) ?? 0;
    const knockX = (this.attackHitbox.getData("knockX") as number) ?? 0;
    const knockY = (this.attackHitbox.getData("knockY") as number) ?? -120;
    this.damageDummy(dummy, dmg);
    (dummy.body as Phaser.Physics.Arcade.Body).setVelocity(knockX, knockY);
  }

  private onProjectileHit(
    proj: Phaser.Physics.Arcade.Image,
    dummy: DummyEnemy,
  ): void {
    if (!dummy.active || !proj.active) return;
    if (proj.getData("hit")) return;
    proj.setData("hit", true);
    const dmg = (proj.getData("damage") as number) ?? 0;
    const knockX = (proj.getData("knockX") as number) ?? 0;
    const knockY = (proj.getData("knockY") as number) ?? -60;
    const vx = (proj.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.damageDummy(dummy, dmg);
    (dummy.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.sign(vx) * knockX,
      knockY,
    );
    this.projectiles.markForDestroy(proj);
  }

  private damageDummy(dummy: DummyEnemy, amount: number): void {
    dummy.hp = Math.max(0, dummy.hp - amount);
    this.spawnDamageNumber(dummy.x, dummy.y - 30, amount, "#ffd060");
    dummy.setTint(0xffffff);
    this.time.delayedCall(70, () => dummy.clearTint());
    if (dummy.hp <= 0) this.killDummy(dummy);
  }

  private onPlayerTouchDummy(dummy: DummyEnemy): void {
    if (!dummy.active) return;
    const now = this.time.now;
    if (now - this.player.lastHurtAt < DUMMY_TOUCH_COOLDOWN_MS) return;
    this.damagePlayer(DUMMY_TOUCH_DAMAGE);
    const dir = this.player.x < dummy.x ? -1 : 1;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(
      dir * 220,
      -220,
    );
  }

  private damagePlayer(amount: number): void {
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

  // ---------------- Spawns ----------------

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
    s.dashUntil = 0;
    s.dashDir = 1;
    s.dropThroughUntil = 0;
    s.weapon = WEAPONS.wooden_sword;
    (s.body as Phaser.Physics.Arcade.Body).setSize(14, 26).setOffset(2, 1);
    return s;
  }

  private spawnDummy(x: number, y: number): DummyEnemy {
    const d = this.physics.add.sprite(x, y, "px-dummy") as DummyEnemy;
    d.setCollideWorldBounds(true);
    d.setImmovable(false);
    d.hp = DUMMY_MAX_HP;
    d.maxHp = DUMMY_MAX_HP;
    d.spawnX = x;
    d.spawnY = y;
    const dBody = d.body as Phaser.Physics.Arcade.Body;
    dBody.setSize(18, 26).setOffset(2, 2);
    dBody.setDragX(900);
    dBody.setMaxVelocity(420, 900);
    d.hpBg = this.add
      .rectangle(x, y - 22, 34, 4, 0x000000, 0.7)
      .setDepth(900);
    d.hpFill = this.add
      .rectangle(x - 16, y - 22, 32, 2, 0xe06070, 1)
      .setOrigin(0, 0.5)
      .setDepth(901);
    this.dummies.add(d);
    return d;
  }

  private killDummy(d: DummyEnemy): void {
    d.setActive(false).setVisible(false);
    d.hpBg.setVisible(false);
    d.hpFill.setVisible(false);
    (d.body as Phaser.Physics.Arcade.Body).enable = false;
    this.spawnHitFlash(d.x, d.y);
    this.time.delayedCall(DUMMY_RESPAWN_DELAY_MS, () => {
      d.setPosition(d.spawnX, d.spawnY);
      d.hp = d.maxHp;
      d.setActive(true).setVisible(true);
      d.hpBg.setVisible(true);
      d.hpFill.setVisible(true);
      (d.body as Phaser.Physics.Arcade.Body).enable = true;
      (d.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    });
  }

  // ---------------- World ----------------

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
      [1180, 340],
      [1420, 290],
      [1720, 360],
      [2020, 320],
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

  // ---------------- HUD ----------------

  private buildHud(): void {
    this.hudBars = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.hpText = this.add
      .text(12, 12, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(1001);
    this.staText = this.add
      .text(12, 30, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(1001);
    this.mpText = this.add
      .text(12, 48, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffffff",
      })
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
    this.drawBar(
      g,
      80,
      32,
      130,
      9,
      this.player.stamina / MAX_STAMINA,
      0xf4d35e,
    );
    this.drawBar(g, 80, 50, 130, 9, this.player.mana / MAX_MANA, 0x6fb6ff);
    this.hpText.setText(`HP  ${Math.ceil(this.player.hp).toString().padStart(3)}`);
    this.staText.setText(
      `STA ${Math.ceil(this.player.stamina).toString().padStart(3)}`,
    );
    this.mpText.setText(
      `MP  ${Math.ceil(this.player.mana).toString().padStart(3)}`,
    );
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

  // ---------------- VFX ----------------

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
}
