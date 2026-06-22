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

## Controls (Roguelands-inspired)
- Move left/right: `A` / `D`
- Jump: `Space` — chainable (infinite, but each press is min 200ms apart; a
  new press cancels the remaining upward velocity of the previous jump)
- Dash left / right: `Q` / `E` — usable mid-air, chainable (min 100ms apart;
  a new dash cancels the remaining distance of the previous one)
- Step up onto one-way platform above: `W`
- Drop through one-way platform: `S`
- Attack: `J` or left mouse click
- Restart after death: `R`

Jumps and dashes consume **stamina**; **mana** regenerates passively and is
reserved for skills added later.

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
