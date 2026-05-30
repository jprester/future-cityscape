# AI Agent Guide

This repo is **Future Cityscape** (React + Vite + R3F), a standalone fork that
began as [SynthCity](https://github.com/jeffbeene/synthcity). The infinite procedural
generation has been removed — the city is finite and hand-authored from a block
template. This guide helps agents make consistent changes quickly.

## Architecture Summary

- **R3F owns rendering.** Do not reintroduce manual renderer/composer loops.
- **State lives in classes** (`src/classes/`). They update positions/values and
  manage collisions.
- **Visuals live in React** (`src/scene/visuals/`). They build meshes/lights and
  bind to class state.
- **Systems** (`src/scene/systems/`) coordinate updates and side effects.
- **UI** lives in `src/ui/` and is fully React-driven.
- **The city is finite.** It is built once at startup by `FiniteCitySystem` from
  a layout produced by `config/cityLayouts/generateLayout.ts`. Do not add
  chunk-streaming / sliding-window generation.

## Key Paths

- `src/config/` – World constants, environments, default settings
- `src/config/cityLayouts/` – Finite city template, layout generator, export/import
- `src/types/` – Shared TypeScript contracts (`settings`, `game`)
- `src/constants/` – Colors, UI labels
- `src/utils/` – Math, angles, random, perlin helpers
- `src/scene/systems/` – GameBridge, FiniteCitySystem, Player, Audio, PointerLock, AssetViewerScene
- `src/scene/visuals/` – Visual mesh/light components
- `src/scene/wallAds/` – Wall-ad placement (manual + procedural signage)
- `src/scene/effects/` – Post-processing, visual presets
- `src/controllers/` – Input hooks
- `src/context/` – Shared app/game state
- `src/classes/` – Legacy state logic (keep JS)
- `public/assets/` – Models, textures, sounds
- `public/layouts/` – JSON city layout files (loaded at runtime via `?layout=`)

## Conventions

- Prefer React/R3F declarative visuals.
- Keep class objects state-only (pose, rotation, velocity, etc.).
- If a class must create a collider mesh, call `updateMatrixWorld(true)` after transforms.
- Avoid adding `window` globals.
- TypeScript is used for React/R3F/UI; classes remain JS.
- Use centralized config: import from `src/config/` for world/environment constants.
- Use centralized utils: import math/random helpers from `src/utils/`.
- Colors and labels live in `src/constants/`.

## Commands

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm run preview` – local preview
- `npm run typecheck` – TypeScript check

## Known Globals

- `Perlin` is provided by `public/js/proc-noise.js` (global).
- For TypeScript code, use `createPerlin()` from `src/utils/perlin.ts` instead of
  a local `declare const Perlin`.

---

## City Layout (`src/config/cityLayouts/`)

The city is described by a fixed block template in `generateLayout.ts`. Each
character maps to a block type:

```
.  empty       r  residential   c  commercial   i  industrial
m  mixed       T  tower         S  skyscraper
A-L specific tower variant      1-4 specific skyscraper
```

`generateLayout(seed)` walks the template once and returns a `FiniteCityLayout`
(buildings, ground tiles, storefronts, spawn, bounds). Within-block detail
(variant, rotation, scale) is sampled from Perlin noise seeded by the world
seed, so layouts are deterministic.

`FiniteCitySystem` consumes the layout: instanced buildings, ground/reflections,
wall ads, smoke, spotlights, collision meshes, and the invisible boundary walls
that contain the player.

To change the city shape, edit `CITY_TEMPLATE` in `generateLayout.ts`.

---

## Building Registry (`src/config/buildingRegistry.ts`)

Single source of truth for all building models. Asset loading, emissive setup,
instanced mesh keys, and ad model keys are all auto-derived — no other files
need updating when adding buildings.

### Series

| Constant | Keys | Used for |
|---|---|---|
| `SMALL_SERIES` | s_01, s_02, s_03 | Residential / commercial / industrial blocks (2×2 grid) |
| `LARGE_SERIES` | s_04 | Large buildings |
| `TOWER_SERIES` | s_05 | Towers |
| `SLIM_TOWER_SERIES` | s_06 | Tall narrow buildings |
| `LANDMARK_SERIES` | landmark_xx | Unique landmark buildings |
| `SKYSCRAPER_SERIES` | skyscraper_xx | Skyscrapers (`S` / `1-4` in the template) |
| `NEW_TOWER_SERIES` | tower_xx | Downtown towers (`T` / `A-L` in the template) |

All series feed the asset pipeline even when not currently placed.

### Adding a building (OBJ)

1. Place `.obj` + textures in `public/assets/models/`
2. Add a `{ key: "s_XX_YY", weight: N }` entry to the appropriate series

### Adding a building (GLB with embedded materials)

1. Place `.glb` in `public/assets/models/`
2. Add an entry with `source: { format: "glb", path: "models/filename.glb", scale?: N, emissiveBase?: N }`
3. That's it — manifest, emissive entry, and instanced mesh key are all derived

---

## JSON Layout Export/Import

### Export

```ts
import { exportLayoutToJSON } from "./src/config/cityLayouts";
const json = exportLayoutToJSON(layout); // JSON string, ready to save
```

### Import via URL

Drop a JSON file in `public/layouts/` and load it with:

```
?layout=my_city.json
```

Falls back to the generated template layout with a console warning if the file
fails to load.

### Format

The `FiniteCityLayout` type is fully serializable — all values are plain numbers
and strings. See `src/config/cityLayouts/types.ts`.

---

## Visual Presets (`src/scene/effects/VisualPresets.ts`)

Post-processing presets, identified by kebab-case ID.

| ID | Name |
|---|---|
| `default` | Default |
| `intense-neon` | Intense Neon |
| `blade-runner` | Blade Runner |
| `retro-crt` | Retro CRT |
| `hypercolor` | Hypercolor |

**Activate via URL:** `?preset=blade-runner`

Adding a preset: add a `VisualPreset` constant and register it in
`VISUAL_PRESETS`. No other files need updating.

---

## URL Query Parameters

All parameters can be combined. `quickstart` (the default) skips the splash;
`?setup` shows the boot terminal instead.

| Param | Values | Default | Notes |
|---|---|---|---|
| `quickstart` | (presence) | on | Skip splash, auto-launch |
| `setup` | (presence) | — | Show boot terminal (disables quickstart) |
| `mode` | `drive`, `freeroam` | `freeroam` | Player control scheme |
| `layout` | filename | — | Load from `public/layouts/` |
| `seed` | integer | 9746 | World seed |
| `quality` | `low`, `medium`, `high` | `medium` | Rendering quality |
| `fps` | `0`, `30`, `60`, `120` | `30` | Frame rate cap (0 = unlimited) |
| `resolution` | `0.5`, `0.75`, `1`, `1.5` | `1` | Render scaling |
| `preset` | preset ID | `default` | Visual post-processing preset |
| `windshield` | `simple`, `advanced` | `simple` | Windshield shader |
| `music` | `0`, `1` | `0` | Background music |
| `sfx` | `0`, `1` | `1` | Sound effects |
| `mode=assets` | — | — | Launch asset viewer (see below) |

**Examples:**
```
?seed=42&preset=blade-runner
?layout=my_city.json
?mode=freeroam&quality=high&fps=60
?mode=assets
```

---

## Asset Viewer (`?mode=assets`)

A standalone mode for inspecting all loaded building models, separate from the
game UI.

**Controls:**
- `←` / `→` — cycle through models (single view)
- `Tab` — toggle single / gallery view
- Mouse — orbit camera (drag to rotate, scroll to zoom)

It uses the same `AssetManager` as the game, so lighting and emissive materials
match the in-game look.

---

## Common Tasks

- **Change the city shape**: edit `CITY_TEMPLATE` in `generateLayout.ts`.
- **Move visuals**: create a component in `src/scene/visuals/` and bind to class state.
- **New update loop**: add a system in `src/scene/systems/`.
- **UI changes**: use `src/context/GameContext.tsx` for shared state.
- **Add constants**: add to the appropriate file in `src/config/` or `src/constants/`.
- **Add utility functions**: add to the appropriate file in `src/utils/`.
- **Add a building model**: see Building Registry above — one entry in `buildingRegistry.ts`.
- **Add a visual preset**: add constant + register in `VISUAL_PRESETS`.

## Don'ts

- Don't reintroduce infinite/chunk-streaming generation — the city is finite.
- Don't reintroduce `window.game` or other global state.
- Don't move class logic into React components unless asked.
- Don't remove collision meshes unless you migrate collision logic too.
- Don't manually update `src/assets/manifests/models.ts` or `src/assets/types.ts`
  for buildings — the registry derives these automatically.
