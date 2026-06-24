# project-r

A 2D side-scrolling action prototype inspired by Roguelands, built with
Phaser 3 and TypeScript. Currently a focused combat sandbox.

## Stack
- Phaser 3 (game engine)
- TypeScript
- Vite (dev server / bundler)

## Run

```
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

## Controls

Movement
- Move left/right: `A` / `D`
- Jump: `Space` — chainable, costs stamina; cancels any in-progress dash
- Dash left / right: `Q` / `E` — usable mid-air, latest dash overrides
- Step up onto one-way platform above: `W`
- Drop through one-way platform: `S`

Combat
- Toggle Combat Mode: right-click (weapon becomes visible and left-click
  attacks; out of combat, left-click is reserved for environment interaction)
- Attack with equipped weapon: left-click (combat mode only); ranged and
  magic projectiles aim toward the mouse cursor
- Switch weapons: `1` Wooden Sword, `2` Wooden Bow, `3` Wooden Staff

Misc
- Restart after death: `R`

## What's in the combat sandbox
- Player with HP, Stamina, Mana resources and bar HUD
- Three test weapons:
  - Wooden Sword — melee, costs stamina
  - Wooden Bow — ranged, mouse-aimed projectile, costs stamina
  - Wooden Staff — magic, mouse-aimed projectile, costs mana
- Mode indicator at top center (EXPLORATION / COMBAT) and a weapon panel
  at top right
- Four dummy enemies at varied positions/heights with HP bars; they take
  damage, knock back, die, and respawn after a delay
- Floating damage numbers, hit flashes, dash ghost trail

## Code layout

```
src/
  scenes/GameScene.ts        — playable test scene
  data/weapons.ts            — weapon definitions + textures
  systems/Projectiles.ts     — pooled arcade-physics projectiles

  data/items.ts              — (parked) item registry for inventory
  systems/Inventory.ts       — (parked) inventory model
  ui/HotbarUI.ts             — (parked) bottom hotbar
  ui/InventoryUI.ts          — (parked) inventory overlay
```

The parked modules are intentionally not wired into the current scene to
keep the combat sandbox focused. They remain available to plug in later.
