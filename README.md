# project-r

A 2D side-scrolling action prototype inspired by Roguelands, built with
Phaser 3 and TypeScript. Currently a combat sandbox covering movement,
weapons, enemies, and skills.

## Run

```
npm install
npm run dev
```

## Controls

Movement
- Move left/right: `A` / `D`
- Jump: `Space` (chainable, costs stamina; cancels current dash)
- Dash left/right: `Q` / `E` (usable mid-air, latest wins)
- Step up onto one-way platform: `W`
- Drop through one-way platform: `S`

Combat
- Toggle Combat Mode: right-click
- Attack with current weapon: left-click (combat mode only); ranged/magic
  shots aim at the mouse cursor
- Switch weapon: `Z` Wooden Sword, `X` Wooden Bow, `C` Wooden Staff

Hotbar (10 slots at bottom-center, `1`–`9`, `0`)
- In Exploration mode: hotbar is the utility bar. Slot 1 = HP potion,
  slot 2 = MP potion. Pressing the number drinks the potion if useful.
- In Combat mode: hotbar is the skill bar. Pressing the number casts the
  skill in that slot (cooldown and mana cost permitting). Cooldowns are
  drawn as a darkening fill with seconds remaining.

Misc
- Restart after death: `R`

## Code layout

```
src/
  scenes/GameScene.ts          — playable sandbox
  data/
    weapons.ts                 — weapon definitions + textures
    items.ts                   — item registry + icons (potions etc.)
    skills.ts                  — skill registry + caster interface + icons
  systems/
    Projectiles.ts             — pooled arcade projectiles
    Inventory.ts               — main/utility/skill slot storage
  ui/HotbarUI.ts               — generic hotbar (slot data via callback)
  entities/
    Enemy.ts                   — base class: HP, aggro, FSM, knockback,
                                 death + respawn, HP bar
    Dummy.ts                   — stationary target
    MeleeChaser.ts             — chases when player is in aggro radius
    RangedEnemy.ts             — kites and fires at the player
```

## Test scene contents
- Player with HP / MP / STA (rendered in that order, top-left)
- Three weapons (sword melee, bow with gravity-after-delay arrows, staff
  with piercing white tracer projectile)
- Two dummies (idle targets), two melee chasers, two ranged enemies.
  Knockback decays in ~220 ms thanks to drag + a hard stop in the
  base `Enemy` class.
- Player projectiles and enemy projectiles live in separate groups so
  enemy shots only damage the player and vice versa.
- Four example skills (Fireball / Heal / Stamina Surge / Blink) pre-bound
  to skill slots 1–4 for combat-mode testing.
