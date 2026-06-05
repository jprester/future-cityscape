import { useEffect, useMemo, useRef, useState } from "react";
import { Mesh, BoxGeometry, MeshStandardMaterial, RepeatWrapping } from "three";
import type { Texture, BufferGeometry } from "three";
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
import { HorizonSkyline } from "../visuals/HorizonSkyline";
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
        // For the rooftop vantage, FiniteCityVantage seats the Rapier capsule on
        // the real deck height once its colliders exist — seating it here at the
        // layout's roofY (below the deck) would wedge it under the deck. Only
        // seat here for non-vantage (street) spawns.
        if (!layout.vantage) game.physics?.setEye({ x, y: eyeY, z });
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
      // Steam plumes belong on the big downtown towers/skyscrapers only. The
      // small residential/commercial fill (`s_01/02/03`) would float its ~190u
      // plume high above its low roof, and across the expanded outskirts those
      // plumes piled up into a flat "fog deck" on the horizon. Restricting to
      // tall buildings (and raising the per-building chance so downtown still
      // reads steamy) keeps the steam where it makes sense and kills the deck.
      const isTall = !b.modelKey.startsWith("s_");
      if (!isTall) continue;
      if (seededRandom() < 0.5) {
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
        const w = 7 + seededRandom() * 5; // width scale (≈28–48 u, fuller soft shaft)
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
      <HorizonSkyline visible={visibility.buildings} />
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

// Local Y of the rooftop GLB's walkable deck = the dominant up-facing surface.
// (The GLB's base is at y=0 but the deck slab sits a bit higher, so we can't
// assume the deck is at the base — find it so the floor collider + spawn land on
// it. Scale-proof: works off the already-scaled geometry.)
function findDeckLocalY(geo: BufferGeometry): number {
  const pos = geo.attributes.position.array as ArrayLike<number>;
  const idx = geo.index?.array as ArrayLike<number> | undefined;
  const count = idx ? idx.length : pos.length / 3;
  const areaByY = new Map<number, number>();
  const accum = (a: number, b: number, c: number) => {
    const ux = pos[b * 3] - pos[a * 3];
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const wx = pos[c * 3] - pos[a * 3];
    const wy = pos[c * 3 + 1] - pos[a * 3 + 1];
    const wz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    if (!len || ny / len <= 0.9) return; // only ~horizontal, up-facing faces
    const cy = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3;
    const key = Math.round(cy * 5) / 5; // 0.2 u buckets
    areaByY.set(key, (areaByY.get(key) ?? 0) + len / 2);
  };
  for (let i = 0; i < count; i += 3) {
    if (idx) accum(idx[i], idx[i + 1], idx[i + 2]);
    else accum(i, i + 1, i + 2);
  }
  let bestY = 0;
  let bestArea = -1;
  for (const [y, area] of areaByY) {
    if (area > bestArea) {
      bestArea = area;
      bestY = y;
    }
  }
  return bestY;
}

// The player's perch: a Blender-authored rooftop cap GLB (`vantage_rooftop`) on
// a plain dark shaft that fills to street level. Collision is Rapier boxes: a
// flat floor + edge walls from the rooftop GLB, plus one solid box per vent
// prop. Footprint + deck height are derived from the GLB so it survives rescale.

// Rooftop vent props, placed on the deck. (dx, dz) are world-unit offsets from
// the vantage centre; `rot` is yaw in radians (keep to 90° steps — the box
// collider only swaps X/Z extents for those). Each gets a matching solid box
// collider, so tweak positions freely here without touching collision code.
const VENT_PLACEMENTS: { key: string; dx: number; dz: number; rot: number }[] =
  [
    // Tall piped vents — left side
    // { key: "vent_01", dx: -15, dz: -3, rot: 0 },
    { key: "vent_01", dx: -15, dz: -15, rot: 0 },
    // Small vents — far edge, 2×2
    { key: "vent_03", dx: -9, dz: 10, rot: 0 },
    { key: "vent_03", dx: -3, dz: 10, rot: 0 },
    { key: "vent_03", dx: -9, dz: 16, rot: 0 },
    { key: "vent_03", dx: -3, dz: 16, rot: 0 },
    // Fan units — single column nearer the ledge (+X edge)
    // { key: "vent_02", dx: 16, dz: -12, rot: 0 },
    { key: "vent_02", dx: 16, dz: -3, rot: 0 },
    { key: "vent_02", dx: 16, dz: 6, rot: 0 },
  ];

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

  // Visible platform: the Blender-authored rooftop cap GLB, sitting on a plain
  // dark shaft that fills down to street level. The GLB is the rooftop the
  // player sees; the shaft is just the building body below (only seen over the
  // edge). Procedural box visuals (deck/parapet/props) were replaced by the GLB.
  const meshes = useMemo(() => {
    if (!v) return [];
    const { x, z, roofY } = v;
    const assets = game?.assets;
    if (!assets?.loaded) return []; // rebuilds when assets finish (see deps)
    const capGeo = assets.getModel("vantage_rooftop");
    if (!capGeo) return [];
    if (!capGeo.boundingBox) capGeo.computeBoundingBox();
    const bb = capGeo.boundingBox!;
    const capW = bb.max.x - bb.min.x;
    const capD = bb.max.z - bb.min.z;
    const out: Mesh[] = [];

    // Shaft — matches the cap footprint, fills street→roof. Owned by us (the
    // userData flag tells the dispose effect it's safe to free, unlike the
    // shared GLB geometry/material from the AssetManager).
    const shaftMat = new MeshStandardMaterial({
      color: "#14141d",
      roughness: 0.9,
      metalness: 0.1,
      emissive: "#0a1622",
      emissiveIntensity: 0.25,
    });
    const shaftGeo = new BoxGeometry(capW, roofY, capD);
    shaftGeo.userData.owned = true;
    shaftMat.userData.owned = true;
    const shaft = new Mesh(shaftGeo, shaftMat);
    shaft.position.set(x, roofY / 2, z);
    out.push(shaft);

    // Rooftop cap GLB — its base (bb.min.y) sits at the roof height (roofY).
    const capMat = assets.getMaterial("__embedded_vantage_rooftop");
    const cap = new Mesh(capGeo, capMat);
    cap.position.set(x, roofY - bb.min.y, z);
    out.push(cap);

    // Vent props on the deck. Each model is centred at its origin with base at
    // y=0, so we drop it on the deck surface. Geometry/materials are shared
    // (AssetManager-owned), so the dispose effect leaves them alone.
    const deckY = roofY + (findDeckLocalY(capGeo) - bb.min.y);
    for (const p of VENT_PLACEMENTS) {
      const geo = assets.getModel(p.key);
      if (!geo) continue;
      const mat = assets.getMaterial(`__embedded_${p.key}`);
      const m = new Mesh(geo, mat);
      m.position.set(x + p.dx, deckY, z + p.dz);
      m.rotation.y = p.rot;
      out.push(m);
    }

    return out;
  }, [v, game?.assets, game?.assets?.loaded]);

  // Dispose only the geometries/materials WE created (tagged userData.owned);
  // the GLB geometry + embedded material are owned by the AssetManager.
  useEffect(() => {
    return () => {
      for (const m of meshes) {
        const geo = m.geometry;
        if (geo?.userData?.owned) geo.dispose();
        const mat = m.material;
        if (!Array.isArray(mat) && mat?.userData?.owned) mat.dispose();
      }
    };
  }, [meshes]);

  // Rapier static colliders for the vantage (the player's kinematic capsule is
  // swept against these by the character controller). The rooftop GLB is just
  // deck + parapet, so collision is two simple box types derived from it:
  //   • Flat floor box — the standing surface at the deck height.
  //   • Edge walls — 4 invisible walls just outside the footprint so the player
  //     can't walk off the roof even though the parapet is low.
  // Rooftop props are placed separately, each with its own matching collider.
  useEffect(() => {
    const physics = game?.physics;
    const assets = game?.assets;
    if (!v || !physics || !assets?.loaded) return;
    const { x, z, roofY } = v;
    const capGeo = assets.getModel("vantage_rooftop");
    if (!capGeo) return;
    if (!capGeo.boundingBox) capGeo.computeBoundingBox();
    const bb = capGeo.boundingBox!;
    const hw = (bb.max.x - bb.min.x) / 2;
    const hd = (bb.max.z - bb.min.z) / 2;
    const cx = x + (bb.max.x + bb.min.x) / 2; // bbox center (GLB is ~centered)
    const cz = z + (bb.max.z + bb.min.z) / 2;
    // Walkable deck height in world units (GLB base sits at roofY since bb.min.y≈0).
    const deckLocalY = findDeckLocalY(capGeo);
    const deckY = roofY + (deckLocalY - bb.min.y);
    const WALL_HALF_H = 1.6; // ~2 m tall — capsule can't autostep over it
    const WALL_HALF_T = 0.5; // 1 u thick, sits just outside the footprint edge
    const wallY = deckY + WALL_HALF_H;

    const ids: string[] = [];
    const addBox = (
      id: string,
      hx: number,
      hy: number,
      hz: number,
      px: number,
      py: number,
      pz: number,
    ) => {
      physics.addStaticBox(id, hx, hy, hz, px, py, pz);
      ids.push(id);
    };

    // Flat floor — the standing surface, top at the deck height.
    addBox("vantage-floor", hw, 2, hd, cx, deckY - 2, cz);
    // Edge walls (inner face flush with the footprint edge) — fall safety.
    addBox(
      "vantage-wall-n",
      hw + WALL_HALF_T,
      WALL_HALF_H,
      WALL_HALF_T,
      cx,
      wallY,
      cz + hd + WALL_HALF_T,
    );
    addBox(
      "vantage-wall-s",
      hw + WALL_HALF_T,
      WALL_HALF_H,
      WALL_HALF_T,
      cx,
      wallY,
      cz - hd - WALL_HALF_T,
    );
    addBox(
      "vantage-wall-e",
      WALL_HALF_T,
      WALL_HALF_H,
      hd + WALL_HALF_T,
      cx + hw + WALL_HALF_T,
      wallY,
      cz,
    );
    addBox(
      "vantage-wall-w",
      WALL_HALF_T,
      WALL_HALF_H,
      hd + WALL_HALF_T,
      cx - hw - WALL_HALF_T,
      wallY,
      cz,
    );

    // One solid box per vent prop, sized to its bounding box (+ a small margin so
    // the player stops far enough back that the vent face stays outside the
    // camera near plane). For 90° yaw the footprint X/Z are swapped.
    const PROP_MARGIN = 0.5;
    VENT_PLACEMENTS.forEach((p, i) => {
      const geo = assets.getModel(p.key);
      if (!geo) return;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const vb = geo.boundingBox!;
      let phx = (vb.max.x - vb.min.x) / 2 + PROP_MARGIN;
      let phz = (vb.max.z - vb.min.z) / 2 + PROP_MARGIN;
      const phy = (vb.max.y - vb.min.y) / 2;
      const quarter = Math.round(p.rot / (Math.PI / 2)) % 2 !== 0;
      if (quarter) [phx, phz] = [phz, phx];
      addBox(`vent-${i}`, phx, phy, phz, x + p.dx, deckY + phy, z + p.dz);
    });

    // Seat the capsule on the deck now that the colliders exist (guards against a
    // spawn applied before they were registered).
    physics.setEye({ x, y: deckY + HUMAN_EYE_HEIGHT_UNITS, z });

    return () => {
      for (const id of ids) physics.removeStatic(id);
    };
  }, [v, game?.physics, game?.assets, game?.assets?.loaded]);

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
        intensity={100}
        distance={190}
        decay={2}
      />
      <pointLight
        position={[v.x - v.width / 4, v.roofY + 10, v.z + v.depth / 4]}
        color="#4a7bff"
        intensity={200}
        distance={100}
        decay={2}
      />
    </>
  );
}
