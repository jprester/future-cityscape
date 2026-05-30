# Future Cityscape Architecture Overview

## Entry Point & Bootstrap

The app starts in `src/main.tsx` which renders `src/App.tsx`. The App wraps
everything in a `GameProvider` context and branches on the URL:

- **`?mode=assets`** → `AssetViewerApp` (standalone asset inspector, no game)
- **everything else** → `SynthCityScene` + `UiShell`

The city is finite and hand-authored from a block template — there is no
infinite procedural streaming.

---

## Game Initialization Flow

1. **GameContext** (`src/context/GameContext.tsx`) provides global state:
   settings, refs (`gameRef`, `terminalRef`), and flags like `launchReady`.

2. **GameBridge** (`src/scene/systems/GameBridge.tsx`) creates the `Game`
   instance in a `useEffect`:
   - Passes camera, canvas, settings, controller
   - Sets up environment (fog, lighting)
   - Applies sky background when `launchReady` is true
   - Triggers `onAssetsLoaded` callback when ready

3. **Game class** (`src/classes/Game.js`) constructor initializes:
   - Collision system (BVH-accelerated raycasting)
   - World constants from `src/config/world.ts`
   - Environment presets from `src/config/environments.ts`

4. **game.init()** is called on user interaction:
   - Creates Player or PlayerCar based on `mode`
   - Sets `isRunning = true`

---

## Player Modes

A single setting controls the control scheme:

- **`mode`** (`"drive"` | `"freeroam"`) — flying car vs. free camera.

There is no city-mode switch; the finite city is the only world.

---

## City Layout (`src/config/cityLayouts/`)

The city is fixed and authored, not streamed.

- **generateLayout.ts** — parses the `CITY_TEMPLATE` block grid and emits a
  `FiniteCityLayout` (buildings, ground tiles, storefronts, spawn, bounds).
  Each template character maps to a block type (empty, residential, commercial,
  industrial, mixed, tower, skyscraper). Within-block detail (which variant,
  rotation, scale) is sampled from Perlin noise seeded by the world seed, so the
  result is deterministic.
- **import.ts / export.ts** — load a layout from JSON (`?layout=name.json`) or
  serialize one back out via `exportLayoutToJSON()`.
- **types.ts** — the `FiniteCityLayout` and placement types. Fully serializable
  (plain numbers and strings).

**FiniteCitySystem** (`src/scene/systems/FiniteCitySystem.tsx`) builds the city
once at startup from the layout:

- Instanced buildings (`InstancedBuildings`)
- Ground tiles, or a single wet-street reflector plane on medium/high quality
- Wall ads (manual + procedural signage), smoke, and spotlights
- Collision meshes registered with the same collider as the player
- Invisible boundary walls so the player can't leave the city bounds

---

## Building Registry (`src/config/buildingRegistry.ts`)

Single source of truth for all building model definitions. Asset loading,
emissive configuration, model manifest entries, instanced mesh keys, and ad
model keys are all **auto-derived** — no other files need updating when adding
buildings.

### Series

| Constant | Keys | Used for |
|----------|------|----------|
| `SMALL_SERIES` | s_01, s_02, s_03 | Residential / commercial / industrial blocks (2×2 grid) |
| `LARGE_SERIES` | s_04 | Large buildings |
| `TOWER_SERIES` | s_05 | Towers |
| `SLIM_TOWER_SERIES` | s_06 | Tall narrow buildings |
| `LANDMARK_SERIES` | landmark_xx | Unique landmark buildings |
| `SKYSCRAPER_SERIES` | skyscraper_xx | Skyscrapers (`S` / `1-4` in the template) |
| `NEW_TOWER_SERIES` | tower_xx | Downtown towers (`T` / `A-L` in the template) |

All series feed the asset pipeline even when not currently placed, so the
manifest and emissive setup stay derived from one place.

### Asset Pipeline

- **OBJ models** share external texture materials (`building_01` – `building_10`)
- **GLB models** use embedded PBR materials stored as `__embedded_{modelKey}`
- `mergeGLTFMeshes()` in AssetManager recombines multi-material GLB mesh groups
  into a single geometry with material groups, allowing `InstancedMesh` with
  `Material[]`

---

## Rendering

Visual components turn the layout into three.js meshes:

- **InstancedBuildings** — renders all buildings of a type in one draw call,
  with frustum + fog-distance culling so off-screen / far buildings are dropped.
- **InstancedMegaBuildings** — same, for the large "mega" buildings.
- **PooledTrafficVisuals** — object-pooled flying cars.
- **CityBlockUpdateableVisuals** — smoke / spotlight billboards driven by
  per-frame `update()` callbacks.

Flying-car traffic is still generated per-region by
`classes/GeneratorItem_Traffic.js`.

Instancing is critical for performance — without it, the thousands of buildings
would each be a separate draw call.

---

## Player System

### PlayerCar (Drive Mode) — `src/classes/PlayerCar.js`
- Autopilot: car bobs sinusoidally, player looks around
- Manual: mouse controls pitch/roll
- Collision via `game.collider`
- Crash freezes briefly, then respawns

### Player (Freeroam Mode) — `src/classes/Player.js`
- WASD movement, R/F for altitude
- Smooth quaternion-based camera look

### Controller — `src/controllers/usePlayerController.ts`
- Captures keyboard/mouse during pointer lock

### Pointer Lock — `src/scene/systems/PointerLockSystem.tsx`
- Source of truth is `document.pointerLockElement`

---

## Scene Structure

```
<Canvas>
  <FrameLimiter />
  <GameBridge />           → Environment, lighting, post-processing
  <FiniteCitySystem />     → Buildings, ground, ads, collision, boundary walls
  <PlayerSystem />         → Player / car visuals
  <AudioSystem />          → Audio management
  <PointerLockSystem />    → Input capture
</Canvas>
```

Asset viewer:

```
<Canvas>
  <RendererSetup />
  <AssetLoader />          → Reuses Game.load() for the asset pipeline
  <OrbitControls />
  <SceneContent />         → Single or gallery view of all registered models
</Canvas>
```

---

## Asset Loading

**AssetManager** (`src/assets/AssetManager.ts`):
- Manifest-based loading (textures, models, materials)
- Supports OBJ, GLB
- Lazy material creation with factories
- Methods: `getModel()`, `getMaterial()`, `getTexture()`

Flow: `game.load()` → creates AssetManager → progress shown in terminal →
`onAssetsLoaded()` sets `launchReady = true`.

---

## Visual Presets (`src/scene/effects/VisualPresets.ts`)

Post-processing presets, identified by kebab-case ID:

| ID | Name |
|----|------|
| `default` | Default |
| `intense-neon` | Intense Neon |
| `blade-runner` | Blade Runner |
| `retro-crt` | Retro CRT |
| `hypercolor` | Hypercolor |

Each preset controls bloom, chromatic aberration, vignette, color grading,
scanlines, noise, and per-category emissive intensity multipliers (ads,
buildings, neons, ambient, smoke).

---

## URL Query Parameters

| Param | Values | Notes |
|-------|--------|-------|
| `quickstart` | (presence) | Skip splash, auto-launch (default on) |
| `setup` | (presence) | Show boot terminal (disables quickstart) |
| `mode` | `drive`, `freeroam`, `assets` | `assets` launches the asset viewer |
| `layout` | filename | Load from `public/layouts/` |
| `seed` | integer | World seed |
| `quality` | `low`, `medium`, `high` | |
| `fps` | `0`, `30`, `60`, `120` | 0 = unlimited |
| `resolution` | `0.5`, `0.75`, `1`, `1.5` | Render scaling |
| `preset` | preset ID | Visual preset (e.g. `blade-runner`) |
| `windshield` | `simple`, `advanced` | |
| `music` | `0`, `1` | |
| `sfx` | `0`, `1` | |

---

## Data Flow Summary

```
URL params
  → querySettings.ts (parse + merge onto defaults)
    → GameSettings
      → FiniteCitySystem
          → generateLayout(seed) or loadLayoutFromURL()
              → parse CITY_TEMPLATE + per-block seeded noise
          → InstancedBuildings / wall ads / smoke / collision / walls

Input (Controller)
  → PlayerSystem (useFrame priority 1)
    → Game.updatePlayer() → position / collision
      → Visual components → render meshes
        → Post-processing (EnhancedEffects)
```

---

## Key Files Reference

| Component | File |
|-----------|------|
| Entry Point | `src/main.tsx`, `src/App.tsx` |
| Context | `src/context/GameContext.tsx` |
| Settings | `src/config/settings.ts`, `src/config/querySettings.ts` |
| Types | `src/types/settings.ts`, `src/types/game.ts` |
| Config | `src/config/world.ts`, `src/config/environments.ts` |
| Building Registry | `src/config/buildingRegistry.ts` |
| City Layout | `src/config/cityLayouts/generateLayout.ts` |
| Visual Presets | `src/scene/effects/VisualPresets.ts` |
| Constants | `src/constants/colors.ts`, `src/constants/labels.ts` |
| Utilities | `src/utils/math.ts`, `src/utils/angles.ts`, `src/utils/random.ts`, `src/utils/perlin.ts` |
| Game Logic | `src/classes/Game.js` |
| Player Logic | `src/classes/Player.js`, `src/classes/PlayerCar.js` |
| Traffic | `src/classes/GeneratorItem_Traffic.js` |
| Systems | `src/scene/systems/*.tsx` |
| Visuals | `src/scene/visuals/*.tsx` |
| Wall Ads | `src/scene/wallAds/*` |
| Assets | `src/assets/AssetManager.ts` |
| Controllers | `src/controllers/usePlayerController.ts` |
| UI | `src/ui/UiShell.tsx` |
| Asset Viewer | `src/scene/systems/AssetViewerScene.tsx`, `src/ui/AssetViewerUI.tsx` |
