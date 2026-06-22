import Phaser from "phaser";

const WORLD_WIDTH = 2880;
const WORLD_HEIGHT = 540;
const GROUND_Y = 480;

const PLAYER_SPEED = 220;
const PLAYER_JUMP = 460;
const PLAYER_MAX_HP = 100;
const ATTACK_COOLDOWN_MS = 320;
const ATTACK_DURATION_MS = 140;
const ATTACK_DAMAGE = 25;

const ENEMY_SPEED = 70;
const ENEMY_MAX_HP = 60;
const ENEMY_TOUCH_DAMAGE = 12;
const ENEMY_TOUCH_COOLDOWN_MS = 700;

type PlayerSprite = Phaser.Physics.Arcade.Sprite & {
  hp: number;
  facing: 1 | -1;
  lastAttackAt: number;
  lastHurtAt: number;
};

type EnemySprite = Phaser.Physics.Arcade.Sprite & {
  hp: number;
  dir: 1 | -1;
  patrolMin: number;
  patrolMax: number;
};

export class GameScene extends Phaser.Scene {
  private player!: PlayerSprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private attackHitbox!: Phaser.GameObjects.Rectangle & {
    body: Phaser.Physics.Arcade.Body;
  };

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private hud!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.makePixelTexture("px-player", 18, 28, 0x6fd3ff, 0x254a5a);
    this.makePixelTexture("px-enemy", 22, 22, 0xff6f7a, 0x5a2530);
    this.makePixelTexture("px-ground", 64, 16, 0x3a3f55, 0x1c1f2b);
    this.makePixelTexture("px-platform", 96, 14, 0x4a5072, 0x252a3d);
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.drawParallaxBackground();
    this.platforms = this.physics.add.staticGroup();
    this.buildLevel();

    this.player = this.spawnPlayer(80, GROUND_Y - 60);
    this.enemies = this.physics.add.group();
    this.spawnEnemy(520, GROUND_Y - 40, 380, 720);
    this.spawnEnemy(1100, GROUND_Y - 40, 980, 1280);
    this.spawnEnemy(1700, GROUND_Y - 40, 1560, 1880);
    this.spawnEnemy(2400, GROUND_Y - 40, 2220, 2620);

    this.attackHitbox = this.add.rectangle(0, 0, 34, 22, 0xffe680, 0) as
      Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    this.physics.add.existing(this.attackHitbox);
    this.attackHitbox.body.setAllowGravity(false);
    this.attackHitbox.body.enable = false;

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(
      this.player,
      this.enemies,
      (_p, e) => this.onPlayerTouchEnemy(e as EnemySprite),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.attackHitbox,
      this.enemies,
      (_hb, e) => this.onAttackHitEnemy(e as EnemySprite),
      undefined,
      this,
    );

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyJ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keySpace = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    this.input.on("pointerdown", () => this.tryAttack());

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(120, 80);

    this.hud = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.hudText = this.add
      .text(12, 12, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(1001);
  }

  update(_time: number, _delta: number): void {
    if (!this.player.active) return;

    const left = this.cursors.left?.isDown || this.keyA.isDown;
    const right = this.cursors.right?.isDown || this.keyD.isDown;
    const jump =
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      (this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up));

    const body = this.player.body as Phaser.Physics.Arcade.Body;
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

    if (jump && body.blocked.down) {
      body.setVelocityY(-PLAYER_JUMP);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyJ)) {
      this.tryAttack();
    }

    if (this.attackHitbox.body.enable) {
      const offsetX = this.player.facing === 1 ? 22 : -22;
      this.attackHitbox.setPosition(this.player.x + offsetX, this.player.y);
      (this.attackHitbox.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
    }

    this.enemies.children.iterate((obj) => {
      const e = obj as EnemySprite;
      if (!e.active) return true;
      const eBody = e.body as Phaser.Physics.Arcade.Body;
      if (e.x <= e.patrolMin) e.dir = 1;
      else if (e.x >= e.patrolMax) e.dir = -1;
      eBody.setVelocityX(ENEMY_SPEED * e.dir);
      e.setFlipX(e.dir === -1);
      return true;
    });

    if (this.player.y > WORLD_HEIGHT + 100) {
      this.damagePlayer(PLAYER_MAX_HP);
    }

    this.drawHud();
  }

  private tryAttack(): void {
    const now = this.time.now;
    if (now - this.player.lastAttackAt < ATTACK_COOLDOWN_MS) return;
    this.player.lastAttackAt = now;

    const offsetX = this.player.facing === 1 ? 22 : -22;
    this.attackHitbox.setPosition(this.player.x + offsetX, this.player.y);
    this.attackHitbox.setFillStyle(0xffe680, 0.5);
    this.attackHitbox.body.enable = true;
    (this.attackHitbox.body as Phaser.Physics.Arcade.Body).updateFromGameObject();

    this.tweens.add({
      targets: this.player,
      scaleX: this.player.facing * 1.1,
      duration: 60,
      yoyo: true,
      onComplete: () => this.player.setScale(this.player.facing, 1),
    });

    this.time.delayedCall(ATTACK_DURATION_MS, () => {
      this.attackHitbox.setFillStyle(0xffe680, 0);
      this.attackHitbox.body.enable = false;
    });
  }

  private onAttackHitEnemy(enemy: EnemySprite): void {
    if (!enemy.active) return;
    enemy.hp -= ATTACK_DAMAGE;
    const knock = this.player.facing * 220;
    (enemy.body as Phaser.Physics.Arcade.Body).setVelocity(knock, -180);
    enemy.setTint(0xffffff);
    this.time.delayedCall(80, () => enemy.clearTint());
    if (enemy.hp <= 0) {
      this.spawnHitFlash(enemy.x, enemy.y);
      enemy.destroy();
    }
  }

  private onPlayerTouchEnemy(enemy: EnemySprite): void {
    if (!enemy.active) return;
    const now = this.time.now;
    if (now - this.player.lastHurtAt < ENEMY_TOUCH_COOLDOWN_MS) return;
    this.damagePlayer(ENEMY_TOUCH_DAMAGE);
    const dir = this.player.x < enemy.x ? -1 : 1;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(dir * 260, -260);
  }

  private damagePlayer(amount: number): void {
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.player.lastHurtAt = this.time.now;
    this.player.setTint(0xff6f7a);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.cameras.main.shake(120, 0.005);
    if (this.player.hp <= 0) this.handlePlayerDeath();
  }

  private handlePlayerDeath(): void {
    this.player.setActive(false).setVisible(false);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    const cam = this.cameras.main;
    const txt = this.add
      .text(cam.midPoint.x, cam.midPoint.y, "YOU DIED\npress R to restart", {
        fontFamily: "monospace",
        fontSize: "28px",
        align: "center",
        color: "#ff8a8a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000);
    txt.setPosition(cam.width / 2, cam.height / 2);
    this.input.keyboard!.once("keydown-R", () => this.scene.restart());
  }

  private spawnPlayer(x: number, y: number): PlayerSprite {
    const s = this.physics.add.sprite(x, y, "px-player") as PlayerSprite;
    s.setCollideWorldBounds(true);
    s.setMaxVelocity(400, 900);
    s.hp = PLAYER_MAX_HP;
    s.facing = 1;
    s.lastAttackAt = -Infinity;
    s.lastHurtAt = -Infinity;
    (s.body as Phaser.Physics.Arcade.Body).setSize(14, 26).setOffset(2, 1);
    return s;
  }

  private spawnEnemy(
    x: number,
    y: number,
    patrolMin: number,
    patrolMax: number,
  ): EnemySprite {
    const e = this.physics.add.sprite(x, y, "px-enemy") as EnemySprite;
    e.setCollideWorldBounds(true);
    e.hp = ENEMY_MAX_HP;
    e.dir = 1;
    e.patrolMin = patrolMin;
    e.patrolMax = patrolMax;
    (e.body as Phaser.Physics.Arcade.Body).setSize(18, 18).setOffset(2, 2);
    this.enemies.add(e);
    return e;
  }

  private buildLevel(): void {
    for (let x = 0; x < WORLD_WIDTH; x += 64) {
      const g = this.platforms.create(x + 32, GROUND_Y + 8, "px-ground") as
        Phaser.Physics.Arcade.Image;
      g.refreshBody();
    }
    const platSpots: Array<[number, number]> = [
      [320, 380],
      [560, 320],
      [820, 380],
      [1180, 340],
      [1420, 290],
      [1720, 360],
      [2020, 320],
      [2260, 280],
      [2520, 350],
    ];
    for (const [px, py] of platSpots) {
      const p = this.platforms.create(px, py, "px-platform") as
        Phaser.Physics.Arcade.Image;
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

  private drawHud(): void {
    const g = this.hud;
    g.clear();
    const x = 12;
    const y = 32;
    const w = 220;
    const h = 14;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(0x2a2f44, 1);
    g.fillRect(x, y, w, h);
    const pct = this.player.hp / PLAYER_MAX_HP;
    g.fillStyle(0x6fd16f, 1);
    g.fillRect(x, y, Math.floor(w * pct), h);
    this.hudText.setText(`HP ${this.player.hp}/${PLAYER_MAX_HP}`);
  }

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
