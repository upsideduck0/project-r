# project-r

A 2D side-scrolling action prototype inspired by Roguelands, built with Phaser 3
and TypeScript.

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
- Move: `A` / `D` or arrow keys
- Jump: `Space`, `W`, or up arrow
- Attack: `J` or left mouse click
- Restart after death: `R`

## What's in the prototype
- Side-scrolling level with ground and platforms
- Player with HP, jumping, double-direction facing
- Melee attack with cooldown and a forward hitbox
- Patrolling enemies with HP, knockback on hit, contact damage to the player
- Camera follow, screen shake on hurt, simple parallax background
- HUD with health bar

## Next steps (toward Roguelands-like depth)
- Loot drops and an inventory
- Ranged weapons and projectiles
- Procedurally generated levels per run (rogue-lite loop)
- Multiple enemy types and a boss
- Equipment / crafting system
- Sprite art to replace generated placeholders
