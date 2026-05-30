# Unreleased - Dependency modernization

- Upgraded the full stack to current majors: React 18 → **19** (`react`,
  `react-dom`), `@react-three/fiber` 8 → **9**, `@react-three/drei` 9 → **10**,
  `@react-three/postprocessing` 2 → **3**, `three` 0.159 → **0.184**,
  `three-mesh-bvh` 0.6 → **0.9**, `postprocessing` → **6.39**, `vite` 5 → **8**,
  `@vitejs/plugin-react` 4 → **6**. No source changes were needed for the
  framework migration (modern color management + standard R3F hooks already).
- `react`/`react-dom` pinned with `~19.2` (R3F 9's peer caps at `<19.3`).
- Removed the legacy webpack build (`webpack.config.js`, the `build:webpack`
  script, `webpack`/`webpack-cli` deps) — Vite is the sole builder.
- Fixed a lighting regression from three 0.184: `scene.environment` now lights
  `MeshPhong`/`Lambert` materials (it didn't ≤0.159), which over-brightened the
  Phong ads/OBJ buildings and made transparent ad backgrounds visible. Added a
  per-environment `environmentIntensity` (applied as `Scene.environmentIntensity`),
  set to `0`, restoring the original look. PBR buildings use their own explicit
  `envMap` and are unaffected.

# Unreleased - Collapse to standalone city + rebrand to Future Cityscape

- Removed the infinite procedural pipeline: `GeneratorSystem`, the
  `GeneratorItem_CityBlock` / `GeneratorItem_CityLight` / `GeneratorItem_GroundLight`
  generators, `GeneratorUtils`, and `CityBlockVisuals`.
- Removed the `procedural` / `finite` city-mode switch (`cityMode`, `?city=`).
  The finite, template-driven city is now the only path.
- Removed the layout district/zone helpers (`cityLayouts/districts.ts`,
  `cityLayouts/zones.ts`) and their types (`DistrictType`, `FiniteDistrict`,
  `ZoneType`, `ZoneBias`). The city shape now comes from `CITY_TEMPLATE` in
  `generateLayout.ts`.
- Removed the unused building-registry threshold-selection helpers
  (`buildVariantThresholds`, `selectVariantFromNoise`, `*_THRESHOLDS`).
- Removed the `cityLights` visibility toggle and the now-unused `cityLights` /
  `spotLights` environment flags, plus orphaned procedural constants in
  `config/world.ts`.
- Rebranded the project to **Future Cityscape** (package name `future-cityscape`,
  README, ARCHITECTURE, AGENTS, page title) for the standalone fork. Code
  identifiers and the "finite city" architecture terms are unchanged. The fork
  lineage / credit to the original SynthCity by Jeff Beene is retained.
- Kept intact but currently unwired into the finite scene (orphaned, retained
  for future use): flying-car traffic (`GeneratorItem_Traffic`,
  `PooledTrafficVisuals`) and mega-building instancing (`InstancedMegaBuildings`).
  The player car and the smoke / spotlight visuals remain in active use.

# 0.6.0 - Landmark & Slim Tower Systems

- Added `LANDMARK_SERIES` to building registry — unique high-quality buildings guaranteed to appear once per city
  - `landmark_01`: `hero-skyscraper.glb`
  - `landmark_02`: `sci-fi-building-9_1.glb`
  - Placed in downtown via a noise-driven pre-pass; position varies by seed, presence is guaranteed
  - Minimum separation enforced between landmark placements
  - `InstancedMesh` capped at 1 instance for landmark keys (memory efficiency)
- Added `SLIM_TOWER_SERIES` (s_06) — tall narrow buildings for downtown's small-building slots
  - `s_06_01`: `brutalist-tower.glb`
  - `s_06_02`: `dark_skyscraper_new2.glb`
  - `s_06_03`: `ny-office-building.glb`
  - Downtown-exclusive: replaces s_01–s_03 selection in the finite city generator
- Moved `brutalist-tower.glb` and `dark_skyscraper_new2.glb` from `LARGE_SERIES` into `SLIM_TOWER_SERIES`
- Moved `sci-fi-building-9_1.glb` from `LARGE_SERIES` and `hero-skyscraper.glb` from `TOWER_SERIES` into `LANDMARK_SERIES`
- Exported `SLIM_TOWER_THRESHOLDS` and `LANDMARK_THRESHOLDS` from registry
- Added `getLandmarkModelKeys()` helper to building registry
- Asset viewer series labels updated for s_06 and landmark keys

# 0.5.0 - District System & JSON Layout Export/Import

- Added district system to finite city generator
  - New types: `DistrictType`, `FiniteDistrict` in `src/config/cityLayouts/types.ts`
  - New file `src/config/cityLayouts/districts.ts`: `DISTRICT_BIASES`, `DEFAULT_DISTRICTS`, `getDistrictBias()`
  - Districts: `downtown`, `industrial`, `residential`, `outskirts`, `default`
  - `generateLayout()` now accepts a `districts` parameter; bias thresholds replace hardcoded 0.1/0.8/0.975 values
  - Downtown: dense towers, high landmark eligibility
  - Industrial: mid-size heavy, no towers
  - Residential: mostly small buildings
  - Outskirts: sparse, low density
- Added JSON layout export: `exportLayoutToJSON()` in `src/config/cityLayouts/export.ts`
- Added JSON layout import: `loadLayoutFromURL()` in `src/config/cityLayouts/import.ts`
  - Validates required fields (`buildings`, `groundTiles`, `bounds`, `spawn`)
  - Falls back to generated layout with console warning on fetch failure
- Added `finiteLayout` setting to `GameSettings` and `src/types/settings.ts`
- Added `?layout=filename` URL param in `querySettings.ts` (implies `city=finite`)
- `FiniteCitySystem` updated to support async layout loading via `useState`/`useEffect`
- Created `public/layouts/` directory for runtime JSON layout files
- Updated `src/config/cityLayouts/index.ts` to export all new functions and types

# 0.4.0 - Finite City Mode, Query Settings & Visual Preset IDs

- Added finite city mode (`cityMode: "finite"`) — static grid city generated from a seed
  - New types: `FiniteCityLayout`, `FiniteBuildingPlacement`, `FiniteMegaPlacement`, `FiniteStorefrontPlacement`
  - New file `src/config/cityLayouts/generateLayout.ts`: 15×15 grid generator using same Perlin noise logic as procedural city
  - New system `src/scene/systems/FiniteCitySystem.tsx`: ground tiles, instanced buildings, mega buildings, collision, boundary walls
  - `cityMode` is orthogonal to `mode` (drive/freeroam) — both can be combined
  - Activate via `?city=finite`
- Added asset viewer mode (`?mode=assets`)
  - `src/scene/systems/AssetViewerScene.tsx`: standalone R3F canvas, single/gallery views, orbit controls
  - `src/ui/AssetViewerUI.tsx`: model key display, series label, format (GLB/OBJ), arrow key + Tab navigation
  - Gallery mode: all models in 4-column grid with key labels
- Added URL query settings system (`src/config/querySettings.ts`)
  - Params: `quickstart`, `mode`, `city`, `layout`, `seed`, `quality`, `fps`, `resolution`, `preset`, `windshield`, `music`, `sfx`
  - `getInitialSettings()` merges URL overrides onto defaults
- Refactored visual preset IDs to kebab-case
  - Added `id` field to `VisualPreset` type
  - IDs: `default`, `intense-neon`, `blade-runner`, `retro-crt`, `hypercolor`
  - `VISUAL_PRESETS` re-keyed by ID; `PRESET_IDS` exported; `PRESET_NAMES` kept as deprecated alias
  - Default preset changed from `"Default"` to `"default"`
  - Activate via `?preset=blade-runner`
- Added `CityMode` type and `cityMode` field to `GameSettings`
- Extended `RuntimeCollider` type with `add(mesh)` / `remove(uuid)` methods

# 0.3.2 - Runtime/Type Hardening

- Unified app settings typing into a single source: `src/types/settings.ts`
- Pointer lock flow hardened: `PointerLockSystem` derives controller/blocker state from actual lock state
- Added typed Perlin wrapper (`src/utils/perlin.ts`), switched `GeneratorSystem` to `createPerlin()`
- Removed `GameBridge` sky/background polling loop in favor of `launchReady`-driven setup
- Replaced remaining `any` casts in `PerformanceMonitor` with typed access
- Added defensive missing-asset guards in `useMegaBuildingInstances`

# 0.3.1

- Replaced baked dark skyscraper model with multi-material GLB (`dark_skyscraper_new2.glb`) for slot `s_04_04`
- Added multi-material GLB support via `mergeGLTFMeshes()` in AssetManager
- Added embedded GLB material system (`useEmbeddedMaterial` manifest option)
- New GLB building models: `sci-fi-building-9_1.glb`, `sci-fi-building-6_1.glb`, `futuristic-tower.glb`
- Added Blender baking script (`scripts/bake_model_textures.py`)
- Emissive texture improvements: disabled mipmaps for crisp window lights at distance
- Per-material emissive intensity control via `BASE_EMISSIVE_INTENSITIES`

# 0.3.0 - Building Instancing & GLB Model Support

- Implemented building instancing for improved rendering performance
- Added 2 new GLB building models
- Added embedded material support for GLB models
- Unified emissive handling across OBJ and GLB pipelines
- Added 4th building variant (`s_04_04`) to city block generation
- Added Blender texture baking script

# 0.2.1 - Code Organization & Cleanup

- Refactored to use centralized config, constants, and utility helpers
- Moved game classes into `src/classes/`
- Added `ARCHITECTURE.md`
- Added emissive property to smoke particles
- New and improved ad sprites

# 0.2.0 - Asset Refactor, Performance & Visual Effects

- Refactored asset management: manifest-based loading, material factories
- Instanced rendering for mega buildings
- Pooled traffic visuals
- Enhanced visual effects system with presets and dynamic rendering options
- Dynamic emissive intensity control and per-group visibility settings
- Performance monitoring for R3F
- Quality and performance options in settings panel

# 0.1.1 - SynthCity 2026 Rework (Initial)

- React + Vite app shell with R3F-managed rendering
- Procedural generation renders declaratively via React components
- Game logic remains in classes; visuals split into R3F components
- Systems layer for GameBridge, Generator, Player, Audio, PointerLock
- TypeScript enabled for React/R3F/UI layer (legacy classes remain JS)
- Ported terminal/settings UI into React, removed jQuery dependency
