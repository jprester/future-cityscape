import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
} from "three";
import type { Texture } from "three";
import { useFrame } from "@react-three/fiber";
import { useGameStore } from "../../context/GameContext";
import { generateLayout, loadLayoutFromURL } from "../../config/cityLayouts";
import { CITY_BLOCK_SIZE, ROAD_WIDTH } from "../../config/world";
import {
  unitsToMeters,
  UNITS_PER_METER,
  HUMAN_EYE_HEIGHT_UNITS,
} from "../../config/scale";
import { createPerlin } from "../../utils";
import type { FiniteCityLayout } from "../../config/cityLayouts";
import {
  InstancedBuildings,
  type BuildingDescriptor,
} from "../visuals/InstancedBuildings";
import { CityBlockUpdateableVisuals } from "../visuals/CityBlockUpdateableVisuals";
import type { GameRuntime, UpdateableVisualState } from "../../types/game";
import {
  FiniteCityWallAds,
  resolveManualWallAds,
  resolveProceduralWallAds,
} from "../wallAds";

type GroundLight = {
  x: number;
  z: number;
  hue: number;
};

export function FiniteCitySystem() {
  const { gameRef, settings, launchReady } = useGameStore();
  const { visibility } = settings;
  const initRef = useRef(false);
  const spawnAppliedRef = useRef(false);

  const [layout, setLayout] = useState<FiniteCityLayout | null>(null);

  useEffect(() => {
    if (settings.finiteLayout) {
      loadLayoutFromURL(`/layouts/${settings.finiteLayout}`)
        .then(setLayout)
        .catch((err) => {
          console.warn(
            "Failed to load layout, falling back to generated:",
            err,
          );
          setLayout(generateLayout(settings.worldSeed));
        });
    } else {
      setLayout(generateLayout(settings.worldSeed));
    }
  }, [settings.finiteLayout, settings.worldSeed]);

  // DEV: audit unique building model heights against the real-meter scale, so
  // we can verify proportions are realistic now that the camera is real-scale.
  // Floors assume ~3.5 m floor-to-floor; scaleNote flags per-instance Y scaling.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const game = gameRef.current;
    if (!layout || !launchReady || !game?.assets?.loaded) return;
    const seen = new Set<string>();
    const rows: Array<Record<string, number | string>> = [];
    for (const b of layout.buildings) {
      if (seen.has(b.modelKey)) continue;
      const geom = game.assets.getModel(b.modelKey);
      if (!geom) continue;
      seen.add(b.modelKey);
      if (!geom.boundingBox) geom.computeBoundingBox();
      const bbox = geom.boundingBox;
      if (!bbox) continue;
      const heightUnits = bbox.max.y - bbox.min.y;
      const heightMeters = unitsToMeters(heightUnits);
      rows.push({
        model: b.modelKey,
        heightUnits: Math.round(heightUnits),
        heightMeters: Math.round(heightMeters),
        floors: Math.round(heightMeters / 3.5),
      });
    }
    rows.sort(
      (a, b) => (a.heightMeters as number) - (b.heightMeters as number),
    );
    // eslint-disable-next-line no-console
    console.log(`[scale audit] ${UNITS_PER_METER} units = 1 m`);
    // eslint-disable-next-line no-console
    console.table(rows);
  }, [layout, launchReady, gameRef]);

  // One-time log of every tower/skyscraper with its (gi, gj) cell coords,
  // so you can author WALL_ADS_MANUAL entries by reading off the table.
  useEffect(() => {
    if (!layout) return;
    const rows = layout.buildings
      .filter(
        (b) =>
          b.modelKey.startsWith("tower_") ||
          b.modelKey.startsWith("skyscraper_"),
      )
      .map((b) => ({
        gi: b.gi ?? -1,
        gj: b.gj ?? -1,
        modelKey: b.modelKey,
        x: Math.round(b.x),
        z: Math.round(b.z),
      }));
    if (rows.length > 0) {
      // eslint-disable-next-line no-console
      console.table(rows);
    }
  }, [layout]);

  // Initialize noise and apply spawn position once game is running
  useFrame(() => {
    const game = gameRef.current;
    if (!game || !game.isRunning || !game.initialized) return;

    if (!initRef.current) {
      if (!game.cityBlockNoise) {
        game.cityBlockNoise = createPerlin(game.settings.worldSeed);
        game.cityBlockNoise.noiseDetail(8, 0.5);
        game.cityBlockNoiseFactor = 0.0017;
      }
      game.generatorsInitialized = true;
      initRef.current = true;
    }

    // Apply layout spawn position once both game and layout are ready
    if (!spawnAppliedRef.current && layout && game.player) {
      const { x, z, rotationY, y, roofModelKey, roofScaleY } = layout.spawn;

      // Resolve the eye-height Y. A rooftop spawn (roofModelKey) needs the
      // model's bounding box, which is only available once assets are loaded —
      // so defer the whole spawn until then rather than landing at street level.
      let eyeY = y;
      if (eyeY == null && roofModelKey) {
        if (!game.assets?.loaded) return;
        const geom = game.assets.getModel(roofModelKey);
        if (!geom) return;
        if (!geom.boundingBox) geom.computeBoundingBox();
        const roofTop = geom.boundingBox?.max.y ?? 0;
        eyeY = roofTop * (roofScaleY ?? 1) + HUMAN_EYE_HEIGHT_UNITS;
      }

      game.player.body.position.x = x;
      game.player.body.position.z = z;
      if (eyeY != null) {
        game.player.body.position.y = eyeY;
        // Place the Rapier character capsule at the spawn (queued until the
        // physics WASM is ready); the controller drives the body from here on.
        game.physics?.setEye({ x, y: eyeY, z });
      }
      if (game.player.camera_target) {
        game.player.camera_target.rotation.y = rotationY;
      }
      spawnAppliedRef.current = true;
    }
  });

  const buildings: BuildingDescriptor[] = useMemo(
    () =>
      (layout?.buildings ?? []).map((b) => ({
        modelKey: b.modelKey,
        materialKey: b.materialKey,
        position: { x: b.x, y: 0, z: b.z },
        scale: { x: b.scaleX, y: b.scaleY, z: b.scaleZ },
        rotationY: b.rotationY,
        blockKey: "finite",
      })),
    [layout],
  );

  // Generate smoke visual states from building positions (seeded for determinism)
  const smokeStates = useMemo(() => {
    if (!layout) return [];
    const smokes: UpdateableVisualState[] = [];
    const smokeMats = ["smoke_01", "smoke_02", "smoke_03"];
    // Simple seeded PRNG from world seed
    let seed = settings.worldSeed;
    const seededRandom = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (const b of layout.buildings) {
      if (seededRandom() < 0.05) {
        const s = 1 + seededRandom() * 8;
        const sy = s * (1 + seededRandom() * 0.5);
        smokes.push({
          isVisual: true,
          kind: "smoke",
          modelKey: "smoke",
          matKey: smokeMats[Math.floor(seededRandom() * smokeMats.length)],
          position: { x: b.x, y: 190 * b.scaleY, z: b.z },
          scale: { x: s, y: sy, z: s },
          rstep: seededRandom() * 7,
        });
      }
    }
    return smokes;
  }, [layout, settings.worldSeed]);

  // Generate searchlight beams. They sit at ROAD CROSSINGS (the gaps between
  // blocks, which are always empty) at street level, so each beam rises out of
  // the city canyon into the sky instead of out of a building roof. The beam is
  // a tall, narrow shaft (non-uniform scale) so it reads against the skyline and
  // roughly fits the road width; surrounding buildings occlude its lower part.
  const spotlightStates = useMemo(() => {
    if (!layout) return [];
    const spots: UpdateableVisualState[] = [];
    const spotMats = [
      "spotlight_01",
      "spotlight_02",
      "spotlight_03",
      "spotlight_04",
    ];
    let seed = settings.worldSeed ^ 0x5b;
    const seededRandom = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Road-crossing lattice: block centers sit at x ≡ CITY_BLOCK_SIZE/2 (mod
    // CELL), so road centers are half a cell further along.
    const CELL = CITY_BLOCK_SIZE + ROAD_WIDTH;
    const ROAD_PHASE = CITY_BLOCK_SIZE + ROAD_WIDTH / 2;
    const { minX, maxX, minZ, maxZ } = layout.bounds;
    const firstRoad = (v: number) =>
      Math.ceil((v - ROAD_PHASE) / CELL) * CELL + ROAD_PHASE;

    for (let x = firstRoad(minX); x <= maxX; x += CELL) {
      for (let z = firstRoad(minZ); z <= maxZ; z += CELL) {
        // ~7% of road crossings get a beam.
        if (seededRandom() > 0.07) continue;
        const matKey = spotMats[Math.floor(seededRandom() * spotMats.length)];
        const w = 5 + seededRandom() * 4; // width scale (≈20–36 u, ~road width)
        const h = 14 + seededRandom() * 8; // height scale (≈700–1100 u shaft)
        const spot: UpdateableVisualState = {
          isVisual: true,
          kind: "spotlight",
          modelKey: "spotlight",
          matKey,
          position: { x, y: 0, z }, // base at street level, in the road gap
          scale: { x: w, y: h, z: w },
          rstep: seededRandom() * 7,
        };
        spot.update = () => {
          // Drives the searchlight sweep (see CityBlockUpdateableVisuals).
          // ~0.018 rad/frame → a gentle few-second sweep cycle.
          spot.rstep = (spot.rstep ?? 0) + 0.018;
        };
        spots.push(spot);
      }
    }
    return spots;
  }, [layout, settings.worldSeed]);

  // Wall ads come from two systems:
  //   • Manual list (src/scene/wallAds/manual.ts) — explicit per-building
  //     ads for unique towers / skyscrapers.
  //   • Procedural (resolveProceduralWallAds) — low-density signage on
  //     small buildings (s_01/s_02/s_03), seeded by worldSeed.
  const wallAdStates = useMemo(() => {
    if (!layout) return [];
    return [
      ...resolveManualWallAds(layout),
      ...resolveProceduralWallAds(layout, settings.worldSeed),
    ];
  }, [layout, settings.worldSeed]);

  // Generate ground uplights at a subset of building positions
  const groundLights: GroundLight[] = useMemo(() => {
    if (!layout) return [];
    const lights: GroundLight[] = [];
    let seed = settings.worldSeed ^ 0xbeef;
    const seededRandom = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (const b of layout.buildings) {
      if (seededRandom() < 0.06) {
        const r = seededRandom();
        let hue: number;
        if (r < 0.3) {
          hue = 300 + r * 100; // magenta/pink
        } else if (r < 0.6) {
          hue = 180 + (r - 0.3) * 100; // cyan/teal
        } else {
          hue = 30 + (r - 0.6) * 80; // warm amber
        }
        lights.push({ x: b.x, z: b.z, hue });
      }
    }
    return lights;
  }, [layout, settings.worldSeed]);

  if (!layout) return null;

  return (
    <>
      <FiniteCityGround
        layout={layout}
        game={gameRef.current}
        visibility={visibility}
      />
      {visibility.buildings && (
        <InstancedBuildings buildings={buildings} game={gameRef.current} />
      )}
      <FiniteCitySmoke
        smokeStates={smokeStates}
        game={gameRef.current}
        visibility={visibility}
      />
      <FiniteCityWallAds
        wallAdStates={wallAdStates}
        game={gameRef.current}
        visibility={visibility}
      />
      <FiniteCitySpotlights
        spotlightStates={spotlightStates}
        game={gameRef.current}
        visibility={visibility}
      />
      {/* Set to true to enable ground uplights */}
      {false &&
        groundLights.map((gl, i) => (
          <group key={`gl-${i}`} position={[gl.x, 5, gl.z]}>
            <pointLight
              intensity={4000}
              distance={300}
              decay={1.5}
              color={`hsl(${gl.hue}, 100%, 55%)`}
            />
          </group>
        ))}
      <FiniteCityVantage
        layout={layout}
        game={gameRef.current}
        visibility={visibility}
      />
    </>
  );
}

// ─── Smoke ───────────────────────────────────────────────────────────────────

function FiniteCitySmoke({
  smokeStates,
  game,
  visibility,
}: {
  smokeStates: UpdateableVisualState[];
  game: GameRuntime | null;
  visibility: { smoke: boolean };
}) {
  // Animate rstep for all smoke each frame
  useFrame(() => {
    for (const s of smokeStates) {
      if (s.rstep !== undefined) {
        s.rstep += 0.0025;
      }
    }
  });

  // Wait for assets to be fully loaded before rendering smoke
  // (CityBlockUpdateableVisuals doesn't re-run its useEffect when assets finish loading)
  if (!game?.assets?.loaded) return null;

  return (
    <>
      {smokeStates.map((s, i) => (
        <CityBlockUpdateableVisuals
          key={i}
          updateable={s}
          game={game}
          visibility={visibility as any}
        />
      ))}
    </>
  );
}

// ─── Spotlights / Holograms ──────────────────────────────────────────────────

function FiniteCitySpotlights({
  spotlightStates,
  game,
  visibility,
}: {
  spotlightStates: UpdateableVisualState[];
  game: GameRuntime | null;
  visibility: { spotlights: boolean };
}) {
  useFrame(() => {
    for (const s of spotlightStates) {
      s.update?.();
    }
  });

  if (!game?.assets?.loaded || !visibility.spotlights) return null;

  return (
    <>
      {spotlightStates.map((s, i) => (
        <CityBlockUpdateableVisuals
          key={i}
          updateable={s}
          game={game}
          visibility={visibility as any}
        />
      ))}
    </>
  );
}

// ─── Ground + Storefronts ─────────────────────────────────────────────────────

function FiniteCityGround({
  layout,
  game,
  visibility,
}: {
  layout: FiniteCityLayout;
  game: GameRuntime | null;
  visibility: { ground: boolean; storefronts: boolean };
}) {
  // A single ground plane covering the whole city (one draw call), with the
  // ground texture cloned and tiled across it to keep the asphalt detail.
  // (Drop-in point for proper road textures later.)
  const groundPlane = useMemo(() => {
    if (!visibility.ground || !game?.assets?.loaded) return null;
    const { minX, maxX, minZ, maxZ } = layout.bounds;

    // Original ground tiles were one cell (block+road) centered on each block,
    // so the texture's cell boundaries sit at `blockX - ROAD_WIDTH/2` — i.e.
    // every tile boundary is congruent to -ROAD_WIDTH/2 (mod CELL_SIZE). To
    // keep the texture aligned with the block grid we snap the big plane's
    // edges to that same lattice and use an integer repeat count, so each
    // texture cell lands exactly on a block (no fractional phase offset).
    const tileSize = CITY_BLOCK_SIZE + ROAD_WIDTH;
    const phase = -ROAD_WIDTH / 2;
    const snapDown = (v: number) =>
      Math.floor((v - phase) / tileSize) * tileSize + phase;
    const snapUp = (v: number) =>
      Math.ceil((v - phase) / tileSize) * tileSize + phase;

    const margin = CITY_BLOCK_SIZE;
    const leftEdge = snapDown(minX - margin);
    const rightEdge = snapUp(maxX + margin);
    const bottomEdge = snapDown(minZ - margin);
    const topEdge = snapUp(maxZ + margin);

    const width = rightEdge - leftEdge;
    const depth = topEdge - bottomEdge;
    const repeatX = Math.round(width / tileSize);
    const repeatY = Math.round(depth / tileSize);

    // Edges land on tile boundaries and repeat is integer, so uv=0 at each edge
    // already coincides with a texture-cell boundary → no offset needed.
    const cloneTiled = (tex: Texture | undefined): Texture | null => {
      if (!tex) return null;
      const t = tex.clone();
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.needsUpdate = true;
      return t;
    };

    return {
      width,
      depth,
      centerX: (leftEdge + rightEdge) / 2,
      centerZ: (bottomEdge + topEdge) / 2,
      map: cloneTiled(game.assets.getTexture("ground")),
      emissiveMap: cloneTiled(game.assets.getTexture("ground_em")),
    };
  }, [visibility.ground, layout.bounds, game?.assets, game?.assets?.loaded]);

  // Dispose the cloned textures when the plane is rebuilt/unmounted.
  useEffect(() => {
    return () => {
      groundPlane?.map?.dispose();
      groundPlane?.emissiveMap?.dispose();
    };
  }, [groundPlane]);

  const storefrontMeshes = useMemo(() => {
    if (!game?.assets?.loaded) return [];
    if (!visibility.storefronts) return [];

    return layout.storefronts.map((sf) => {
      const geometry = game.assets!.getModel("storefronts");
      const material = game.assets!.getMaterial(sf.materialKey);
      const mesh = new Mesh(geometry, material);
      mesh.position.set(sf.x, 0, sf.z);
      return mesh;
    });
  }, [layout, game?.assets?.loaded, visibility.storefronts]);

  return (
    <group>
      {groundPlane && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[groundPlane.centerX, 0, groundPlane.centerZ]}
          receiveShadow>
          <planeGeometry args={[groundPlane.width, groundPlane.depth]} />
          {/* Matte asphalt: the tiled ground texture provides the detail and
              the emissive map keeps the subtle blue ground glow. */}
          <meshStandardMaterial
            roughness={0.8}
            metalness={0}
            color="#3a3a48"
            map={groundPlane.map ?? undefined}
            emissiveMap={groundPlane.emissiveMap ?? undefined}
            emissive="#0090ff"
            emissiveIntensity={0.2}
          />
        </mesh>
      )}
      {storefrontMeshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  );
}

// ─── Rooftop Vantage ───────────────────────────────────────────────────────────

// The player's perch. A simple, fully procedural flat-topped box tower (no GLB)
// so the roof is guaranteed flat and the footprint exact. The shaft is a plain
// rectangle (only ever seen from the roof edge); the roof gets a low knee-high
// parapet ledge + a few cubic structures.
//
// Collision is handled by Rapier (see the static-collider effect below):
// the visible shaft/parapet/cubes are purely cosmetic — the player is stood up
// and contained by invisible floor/wall/prop colliders.
const PARAPET_HEIGHT = 0.8; // ~0.5 m — knee-high ledge, stays well clear of the view
const PARAPET_THICKNESS = 1.5;

function FiniteCityVantage({
  layout,
  game,
  visibility,
}: {
  layout: FiniteCityLayout;
  game: GameRuntime | null;
  visibility: { buildings: boolean };
}) {
  const v = layout.vantage;

  // Rooftop structures (cubic shapes), defined once so the visible mesh and the
  // collision box stay in sync — the player is blocked from walking into them.
  const structures = useMemo(() => {
    if (!v) return [];
    const { x, z, width, depth, roofY } = v;
    return [
      // HVAC block, far corner
      {
        w: 12,
        h: 6,
        d: 9,
        cx: x + width / 2 - 11,
        cy: roofY + 3,
        cz: z - depth / 2 + 10,
      },
      // Vent stack, opposite corner
      {
        w: 4,
        h: 11,
        d: 4,
        cx: x - width / 2 + 10,
        cy: roofY + 5.5,
        cz: z + depth / 2 - 10,
      },
    ];
  }, [v]);

  // Visible platform: shaft + parapet rails + rooftop structures.
  const meshes = useMemo(() => {
    if (!v) return [];
    const { x, z, width, depth, roofY } = v;
    const out: Mesh[] = [];

    // Shaft — top face at roofY is the roof surface. Player only sees this from
    // the roof edge, so a plain dark slab is fine.
    const shaftMat = new MeshStandardMaterial({
      color: "#14141d",
      roughness: 0.9,
      metalness: 0.1,
      emissive: "#0a1622",
      emissiveIntensity: 0.25,
    });
    const shaft = new Mesh(new BoxGeometry(width, roofY, depth), shaftMat);
    shaft.position.set(x, roofY / 2, z);
    out.push(shaft);

    // Parapet — a low knee-high ledge ringing the roof edge.
    const parapetMat = new MeshStandardMaterial({
      color: "#23232e",
      roughness: 0.8,
      metalness: 0.2,
    });
    const py = roofY + PARAPET_HEIGHT / 2;
    const railNS = new BoxGeometry(width, PARAPET_HEIGHT, PARAPET_THICKNESS);
    const railEW = new BoxGeometry(PARAPET_THICKNESS, PARAPET_HEIGHT, depth);
    const offZ = depth / 2 - PARAPET_THICKNESS / 2;
    const offX = width / 2 - PARAPET_THICKNESS / 2;
    for (const sz of [offZ, -offZ]) {
      const rail = new Mesh(railNS, parapetMat);
      rail.position.set(x, py, z + sz);
      out.push(rail);
    }
    for (const sx of [offX, -offX]) {
      const rail = new Mesh(railEW, parapetMat);
      rail.position.set(x + sx, py, z);
      out.push(rail);
    }

    // Rooftop structures — a couple of cubic shapes for visual interest, tucked
    // into corners away from the (centered) spawn.
    const structMat = new MeshStandardMaterial({
      color: "#3a3a48",
      roughness: 0.6,
      metalness: 0.45,
    });
    for (const s of structures) {
      const m = new Mesh(new BoxGeometry(s.w, s.h, s.d), structMat);
      m.position.set(s.cx, s.cy, s.cz);
      out.push(m);
    }

    return out;
  }, [v, structures]);

  // Dispose geometries/materials when the platform is rebuilt/unmounted.
  useEffect(() => {
    return () => {
      const geos = new Set<BoxGeometry>();
      const mats = new Set<MeshStandardMaterial>();
      for (const m of meshes) {
        geos.add(m.geometry as BoxGeometry);
        mats.add(m.material as MeshStandardMaterial);
      }
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    };
  }, [meshes]);

  // Rapier static colliders for the vantage (the player's kinematic capsule is
  // swept against these by the character controller):
  //   • Floor — a flat box whose top is the roof surface; the capsule stands on it.
  //   • Edge walls — 4 invisible walls just outside the footprint, taller than
  //     the capsule, so the player can't walk off the roof. The visible parapet
  //     stays knee-high; these are the actual containment.
  //   • Props — a box per HVAC/vent so the capsule is stopped at them.
  useEffect(() => {
    const physics = game?.physics;
    if (!v || !physics) return;
    const { x, z, width, depth, roofY } = v;
    const hw = width / 2;
    const hd = depth / 2;
    const WALL_HALF_H = 1.6; // ~2 m tall — capsule can't autostep over it
    const WALL_HALF_T = 0.5; // 1 u thick, sits just outside the footprint edge
    const wallY = roofY + WALL_HALF_H;

    const ids: string[] = [];
    const add = (
      id: string,
      hx: number,
      hy: number,
      hz: number,
      cx: number,
      cy: number,
      cz: number,
    ) => {
      physics.addStaticBox(id, hx, hy, hz, cx, cy, cz);
      ids.push(id);
    };

    // Floor: top face at roofY.
    add("vantage-floor", hw, 2, hd, x, roofY - 2, z);
    // Edge walls (inner face flush with the footprint edge).
    add("vantage-wall-n", hw + WALL_HALF_T, WALL_HALF_H, WALL_HALF_T, x, wallY, z + hd + WALL_HALF_T);
    add("vantage-wall-s", hw + WALL_HALF_T, WALL_HALF_H, WALL_HALF_T, x, wallY, z - hd - WALL_HALF_T);
    add("vantage-wall-e", WALL_HALF_T, WALL_HALF_H, hd + WALL_HALF_T, x + hw + WALL_HALF_T, wallY, z);
    add("vantage-wall-w", WALL_HALF_T, WALL_HALF_H, hd + WALL_HALF_T, x - hw - WALL_HALF_T, wallY, z);
    // Props. The collider footprint is grown horizontally so the player is
    // stopped a bit back from the visible surface — otherwise they stop within
    // the camera near plane (1 u) of the box face and the renderer clips it
    // away (you "see through" the HVAC/vent). Height is left at the visible
    // size. Margin = near plane (1) − capsule radius (0.6) + slack.
    const PROP_MARGIN = 1.0;
    structures.forEach((s, i) => {
      add(
        `vantage-prop-${i}`,
        s.w / 2 + PROP_MARGIN,
        s.h / 2,
        s.d / 2 + PROP_MARGIN,
        s.cx,
        s.cy,
        s.cz,
      );
    });

    // Seat the capsule on the roof now that the floor exists — guards against a
    // spawn applied before these colliders were registered (the character would
    // otherwise fall past the not-yet-present floor).
    physics.setEye({ x, y: roofY + HUMAN_EYE_HEIGHT_UNITS, z });

    return () => {
      for (const id of ids) physics.removeStatic(id);
    };
  }, [v, structures, game?.physics]);

  if (!v || !visibility.buildings) return null;
  return (
    <>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
      {/* Rooftop lighting so the deck reads against the night skyline: a warm
          key light high over the center plus a cooler fill toward the corner
          structures. (Local point lights — kept off the rest of the city.) */}
      <pointLight
        position={[v.x, v.roofY + 24, v.z]}
        color="#ffe6c0"
        intensity={1200}
        distance={190}
        decay={2}
      />
      {/* <pointLight
        position={[v.x - v.width / 4, v.roofY + 10, v.z + v.depth / 4]}
        color="#4a7bff"
        intensity={600}
        distance={100}
        decay={2}
      /> */}
    </>
  );
}

