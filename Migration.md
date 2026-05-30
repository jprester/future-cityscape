# Migration Notes

This document summarizes the modernization work from the original Three.js app to the current React + Vite + R3F architecture.

## Overview

- Rendering is now owned by React Three Fiber (R3F).
- Legacy classes are retained for simulation/state, but visuals are rendered declaratively in React.
- UI and boot flow are React-driven (Terminal + Settings).
- Audio and pointer lock are handled by dedicated R3F systems.

## Key Architectural Changes

1. **React + Vite + R3F**
   - R3F owns the render loop and renderer.
   - The scene is composed in `src/scene/systems/SynthCityScene.tsx`.

2. **Systems vs Visuals**
   - Systems live in `src/scene/systems/` and own updates/side-effects.
   - Visuals live in `src/scene/visuals/` and render meshes/lights based on class state.

3. **Classes are state-only**
   - Classes in `src/classes/` now keep simulation state.
   - Visual meshes/lights are created in React components, not in classes.
   - Colliders remain class-owned because they are used by BVH collisions.

4. **TypeScript**
   - TS is enabled for React/R3F/UI.
   - Legacy classes remain JS (`allowJs` in `tsconfig.json`).

5. **Folder renames**
   - `src/r3f` -> `src/scene`
   - `src/game` -> `src/context`

## Notable Migrations

- **Generator**
  - City blocks render via `CityBlockVisuals`.
  - Updateables (ads/topper/smoke/spotlight) render via `CityBlockUpdateableVisuals`.
  - Traffic cars render via `TrafficCarVisuals`.
  - City lights are now data descriptors rendered with `<pointLight>`.

- **Player**
  - `PlayerCar` is state-only (pose tracked via `carPose`).
  - Visual car meshes/light are rendered via `PlayerCarVisuals`.

- **Audio**
  - Lifecycle handled in `AudioSystem`.

- **Pointer Lock**
  - Handled in `PointerLockSystem`.

## Known Legacy Dependencies

- `public/js/alea.js` and `public/js/proc-noise.js` provide global `Perlin` noise.
- Assets are served from `public/assets/`.

## Recent P1 Hardening

- **Shared settings type layer**
  - Added `src/types/settings.ts` as the single source for `GameSettings`, `QualityLevel`, `FrameRateLimit`, and `VisibilitySettings`.
  - Context/config/runtime contracts now reference this shared type set.

- **Pointer lock state flow**
  - Launch no longer assumes pointer lock success.
  - `PointerLockSystem` now drives UI blocker and controller enabled state from actual lock state (`document.pointerLockElement`).

- **Perlin wrapper**
  - Added `src/utils/perlin.ts` (`createPerlin`) to avoid ad-hoc `declare const Perlin` usage in TS files.
  - Global script dependency remains (`public/js/proc-noise.js`), but TS integration is now centralized and typed.

- **Background setup**
  - `GameBridge` no longer polls for assets with an interval.
  - Scene background is applied once assets are ready (`launchReady`).

- **Additional safety/typing cleanup**
  - `PerformanceMonitor` now uses typed browser memory access (no `any`).
  - `useMegaBuildingInstances` now guards missing material/geometry to avoid invalid instanced meshes.

## Suggested Next Steps

- Optional: migrate remaining class-level mesh construction to descriptors.
- If desired, replace the global Perlin script with an ESM module implementation.
