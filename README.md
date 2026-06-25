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
- Toggle developer console: backtick `` ` `` (Esc closes)

## Developer console

Open with backtick. While focused, game input is suspended so typing won't
move the player. Commands (leading slash optional):

- `/spawn <kind>` — spawn an enemy in front of the player. Kinds:
  `tank`, `fighter`, `thief`, `commander`, `chaser`, `caster`, `archer`,
  `dummy`.
- `/give <id>` — add an item (`hp_potion`, `mp_potion`, ...) to the utility
  bar, or bind a skill (`fireball`, `heal`, `surge`, `blink`) to the next
  free skill slot.
- `/fh` — full heal (HP/MP/STA to max).
- `/stats [kind]` — print the player's stat block, or a living enemy's of
  the given kind.
- `/help` — list commands.

Arrow Up/Down browse command history.

## Character stat framework

`src/systems/stats/` holds the attribute -> stat pipeline shared by all
creatures (players, enemies, bosses, future NPCs):

- Attributes: VIT, MIG, AGI, INT, INS, PRE
- Main Stats: HP, MP, STA, ATK, DEF, MS, AS, TEN
- Sub Stats: GEN, CRR, CRD, CDR, PEN, AMP, LS, LUC

`StatBlock` runs `base attributes (+mods) -> derived main/sub (+innate base)
-> (+mods) -> final values`, cached until something changes. All conversion
coefficients live in `formulas.ts` so balancing never touches gameplay code.
Modifiers carry a source tag (`equipment` / `buff` / `debuff` / `passive` /
`class` / `temporary`) for future systems to inject and remove cleanly.

Note: the framework is wired onto every entity for inspection, but current
HP/damage/skill values still drive gameplay — no rebalance yet.

## Code layout

```
src/
  scenes/GameScene.ts          — playable sandbox
  data/
    weapons.ts                 — weapon definitions + textures
    items.ts                   — item registry + icons (potions etc.)
    skills/                    — skill framework (3-layer: core/scaling/type)
      types.ts                 — SkillDef, tags, rarity, requirements, type data
      formulas.ts              — centralized damage + requirement checks
      executor.ts              — tag/type-driven skill execution (no per-skill code)
      registry.ts              — skill definitions as pure data
      icons.ts                 — skill icon textures
  systems/
    Projectiles.ts             — pooled arcade projectiles
    Inventory.ts               — main/utility/skill slot storage
    stats/                     — character stat framework
      types.ts                 — attribute / main / sub stat keys + sets
      formulas.ts              — centralized attribute -> stat conversion
      modifiers.ts             — StatModifier + source tags
      StatBlock.ts             — per-creature pipeline + debug output
  ui/
    HotbarUI.ts                — generic hotbar (slot data via callback)
    DevConsole.ts              — in-game developer console (DOM overlay)
  entities/
    Enemy.ts                   — base class: HP, aggro, FSM, knockback,
                                 death + respawn, HP bar, buffs, StatBlock
    Dummy.ts                   — stationary target
    MeleeChaser.ts             — chases when player is in aggro radius
    RangedEnemy.ts             — caster: kites and fires magic bolts
    ArcherEnemy.ts             — kites and fires arcing arrows
    TankEnemy.ts               — high HP, slow, knockback-resistant
    FighterEnemy.ts            — baseline melee
    ThiefEnemy.ts              — low HP, fast, repositions constantly
    CommanderEnemy.ts          — buffs nearby allies via aura
```

## Test scene contents
- Closed single-room arena (960×540) walled on all four sides, three
  one-way platforms in the air.
- Default enemies: tank (front), thief, caster, then commander. Spawn more
  of any kind via the developer console.
- Player with HP / MP / STA (rendered in that order, top-left). Faces the
  mouse cursor in any mode.
- Three weapons (sword melee with a 3-frame swing, bow with
  gravity-after-delay arrows, staff with piercing white tracer projectile).
- Player projectiles and enemy projectiles live in separate groups so
  enemy shots only damage the player and vice versa.
- Four example skills (Fireball / Heal / Stamina Surge / Blink) pre-bound
  to skill slots 1–4 for combat-mode testing.
- Commander aura buffs (configurable): tank +damage reduction, fighter
  +attack speed, thief +movement speed; all removed when the commander
  dies.
