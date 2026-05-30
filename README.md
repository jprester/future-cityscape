# Future Cityscape (React + R3F)

Future Cityscape is an interactive WebGL experience: explore a hand-authored
cyberpunk city, on foot or in a flying car. It is built with React, Vite, and
React Three Fiber (R3F).

> **Lineage:** This project began as a fork of [SynthCity](https://github.com/jeffbeene/synthcity)
> by Jeff Beene. It has since been collapsed into a standalone finite-city
> experience — the original infinite procedural generation has been removed.

![Screenshot](screenshots/screenshot1.png)

## Quick Start

Requirements: Node.js (LTS recommended).

```bash
npm install
npm run dev
```

```bash
npm run build && npm run preview   # production build
npm run typecheck                  # TypeScript check
```

## Controls

- **Mouse**: look / steer
- **Mouse wheel**: zoom
- **W/S**: boost / brake (drive) · **W/A/S/D**: move (freeroam)
- **R/F**: adjust height (freeroam)
- **Space**: toggle autopilot (drive)
- **+/-**: volume
- **]**: skip song
- **P**: pause song
- **Esc**: open terminal

## URL Parameters

All parameters can be combined freely.

| Param | Values | Notes |
|-------|--------|-------|
| `quickstart` | (presence) | Skip splash screen, auto-launch (default on) |
| `setup` | (presence) | Show the boot terminal/splash (disables quickstart) |
| `mode` | `drive`, `freeroam` | Player control scheme |
| `layout` | filename | Load a saved layout from `public/layouts/` |
| `seed` | integer | World seed (within-block variation) |
| `quality` | `low`, `medium`, `high` | |
| `fps` | `0`, `30`, `60`, `120` | 0 = unlimited |
| `resolution` | `0.5`, `0.75`, `1`, `1.5` | Render scaling |
| `preset` | preset ID | Visual preset |
| `windshield` | `simple`, `advanced` | |
| `music` | `0`, `1` | |
| `sfx` | `0`, `1` | |

**Visual preset IDs:** `default`, `intense-neon`, `blade-runner`, `retro-crt`, `hypercolor`

**Examples:**
```
?seed=42&preset=blade-runner
?layout=my_city.json
?mode=freeroam&quality=high
?mode=assets
```

## The City

The city is finite and hand-authored — there is no infinite streaming. A fixed
block template in `src/config/cityLayouts/generateLayout.ts` describes the whole
city; each character maps to a block type:

```
.  empty       r  residential   c  commercial   i  industrial
m  mixed       T  tower         S  skyscraper
A-L specific tower variant      1-4 specific skyscraper
```

`generateLayout(seed)` walks the template once at startup and emits a
`FiniteCityLayout` (buildings, ground tiles, storefronts, spawn, bounds).
Within-block detail (which variant, rotation, scale, signage) is sampled from
Perlin noise seeded by the world seed, so the same seed always produces the
same city.

`FiniteCitySystem` consumes that layout: it builds the instanced buildings,
ground/reflections, wall ads, smoke, and spotlights, registers collision
meshes, and walls off the city bounds with invisible colliders.

### JSON Layout Export/Import

Any layout can be serialized and reloaded:

```ts
import { exportLayoutToJSON } from "./src/config/cityLayouts";
const json = exportLayoutToJSON(layout); // ready to save
```

Drop the JSON in `public/layouts/` and load it with `?layout=my_city.json`.
On failure it falls back to the generated template layout with a console
warning.

## Asset Viewer

Standalone mode for inspecting all registered building models:

```
?mode=assets
```

- **Single view**: orbit one model; `←`/`→` to cycle, `Tab` to switch views
- **Gallery view**: all models in a 4-column grid with labels

## Building Registry

`src/config/buildingRegistry.ts` is the single source of truth for all building
models. Adding a building (OBJ or GLB) requires only one entry in the registry —
asset loading, emissive setup, instanced mesh keys, and manifest entries are all
auto-derived.

**Series:**

| Series | Keys | Used for |
|--------|------|----------|
| `SMALL_SERIES` | s_01–s_03 | Residential / commercial / industrial blocks (2×2 grid) |
| `LARGE_SERIES` | s_04 | Large buildings |
| `TOWER_SERIES` | s_05 | Towers |
| `SLIM_TOWER_SERIES` | s_06 | Tall narrow buildings |
| `LANDMARK_SERIES` | landmark_xx | Unique landmark buildings |
| `SKYSCRAPER_SERIES` | skyscraper_xx | Skyscrapers (`S` / `1-4` in the template) |
| `NEW_TOWER_SERIES` | tower_xx | Downtown towers (`T` / `A-L` in the template) |

All series feed the asset pipeline even when not currently placed, so the model
manifest and emissive setup stay derived from one place.

## Project Structure

```
src/
  App.tsx                        # Root (asset viewer vs. main scene)
  main.tsx                       # React entry point
  config/
    buildingRegistry.ts          # All building model definitions (single source of truth)
    settings.ts                  # Default game settings
    querySettings.ts             # URL param parsing
    world.ts                     # World constants (grid, seeds, altitudes)
    environments.ts              # Night/day environment presets
    cityLayouts/
      types.ts                   # FiniteCityLayout + placement types
      generateLayout.ts          # Block template → city layout
      export.ts                  # exportLayoutToJSON()
      import.ts                  # loadLayoutFromURL()
      index.ts                   # Barrel exports
  types/
    settings.ts                  # GameSettings, QualityLevel, etc.
    game.ts                      # GameRuntime, RuntimeCollider, etc.
  scene/
    systems/
      SynthCityScene.tsx         # R3F canvas + system composition
      GameBridge.tsx             # Game init, camera, post-processing
      FiniteCitySystem.tsx       # Builds the finite city from a layout
      PlayerSystem.tsx           # Player updates + car visuals
      AudioSystem.tsx            # Music/SFX lifecycle
      PointerLockSystem.tsx      # Pointer lock management
      AssetViewerScene.tsx       # Standalone asset inspector canvas
    visuals/
      useBuildingInstances.ts    # InstancedMesh setup for all building series
      InstancedBuildings.tsx     # Instanced render + frustum/fog culling
      InstancedMegaBuildings.tsx
      PlayerCarVisuals.tsx
      TrafficCarVisuals.tsx
      PooledTrafficVisuals.tsx
      CityBlockUpdateableVisuals.tsx
    wallAds/                     # Wall-ad placement (manual + procedural signage)
    effects/
      VisualPresets.ts           # Post-processing preset definitions
  assets/
    AssetManager.ts              # Manifest loader, GLB merging, material storage
    manifests/                   # Model/texture/material manifests (registry-driven)
  controllers/usePlayerController.ts
  context/GameContext.tsx
  ui/                            # UiShell, AssetViewerUI
  classes/                       # Legacy state classes (remain JS)
scripts/
  bake_model_textures.py         # Blender texture baking script
public/
  assets/                        # Textures, models (OBJ + GLB), audio
  layouts/                       # JSON city layout files (loaded via ?layout=)
```

## Credits

- Bladerunner Sedan 3d Model - Quaz30 [sketchfab.com/quaz30](https://sketchfab.com/quaz30)
- Sound FX - Various contributors on [freesound.org](https://freesound.org)
- Music from [#Uppbeat](https://uppbeat.io/) (free for Creators!)
  - prigida, pecanpie, mountaineer, d0d, fass, tatami, kaleidoscope, noisecake, moodmaze, bosnow, tecnosine
- Original SynthCity by Jeff Beene — [jeff-beene.com](https://www.jeff-beene.com)
