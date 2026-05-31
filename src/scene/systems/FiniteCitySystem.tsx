import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
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
    rows.sort((a, b) => (a.heightMeters as number) - (b.heightMeters as number));
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

  // Generate spotlight/hologram visual states for industrial buildings (s_03)
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
    for (const b of layout.buildings) {
      if (!b.modelKey.startsWith("s_03_")) continue;
      // ~25% of industrial buildings
      if (seededRandom() > 0.25) continue;
      const matKey = spotMats[Math.floor(seededRandom() * spotMats.length)];
      const s = 10 + seededRandom() * 10;
      const spot: UpdateableVisualState = {
        isVisual: true,
        kind: "spotlight",
        modelKey: "spotlight",
        matKey,
        position: { x: b.x, y: 160 * b.scaleY, z: b.z },
        scale: { x: s, y: s, z: s },
        rstep: seededRandom() * 7,
      };
      spot.update = () => {
        spot.rstep = (spot.rstep ?? 0) + 0.01;
      };
      spots.push(spot);
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
      <FiniteCityCollision layout={layout} game={gameRef.current} />
      <FiniteCityBoundary layout={layout} game={gameRef.current} />
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

// ─── Collision Registration ───────────────────────────────────────────────────

function FiniteCityCollision({
  layout,
  game,
}: {
  layout: FiniteCityLayout;
  game: GameRuntime | null;
}) {
  const colliderMeshesRef = useRef<Mesh[]>([]);

  useEffect(() => {
    if (!game?.assets?.loaded || !game.collider) return;

    const meshes: Mesh[] = [];

    // Building collision meshes
    for (const b of layout.buildings) {
      const geometry = game.assets!.getModel(b.modelKey);
      if (!geometry) continue;
      const material = game.assets!.getMaterial(b.materialKey);
      const mesh = new Mesh(geometry, material);
      mesh.position.set(b.x, 0, b.z);
      mesh.scale.set(b.scaleX, b.scaleY, b.scaleZ);
      mesh.rotation.y = b.rotationY;
      mesh.updateMatrixWorld(true);
      game.collider.add(mesh);
      meshes.push(mesh);
    }

    // Storefront collision meshes
    for (const sf of layout.storefronts) {
      const geometry = game.assets!.getModel("storefronts");
      if (!geometry) continue;
      const material = game.assets!.getMaterial(sf.materialKey);
      const mesh = new Mesh(geometry, material);
      mesh.position.set(sf.x, 0, sf.z);
      mesh.updateMatrixWorld(true);
      game.collider.add(mesh);
      meshes.push(mesh);
    }

    colliderMeshesRef.current = meshes;

    return () => {
      for (const mesh of colliderMeshesRef.current) {
        game.collider.remove(mesh.uuid);
      }
      colliderMeshesRef.current = [];
    };
  }, [layout, game?.assets?.loaded, game?.collider]);

  return null;
}

// ─── Boundary Walls ───────────────────────────────────────────────────────────

function FiniteCityBoundary({
  layout,
  game,
}: {
  layout: FiniteCityLayout;
  game: GameRuntime | null;
}) {
  const wallMeshesRef = useRef<Mesh[]>([]);

  useEffect(() => {
    if (!game?.collider) return;

    const { minX, maxX, minZ, maxZ } = layout.bounds;
    const wallHeight = 1000;
    const xSpan = maxX - minX;
    const zSpan = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const invisMat = new MeshBasicMaterial({
      visible: false,
      side: DoubleSide,
    });

    const walls: Mesh[] = [];

    // North wall (maxZ)
    const northGeo = new PlaneGeometry(xSpan, wallHeight);
    const northWall = new Mesh(northGeo, invisMat);
    northWall.position.set(centerX, wallHeight / 2, maxZ);
    northWall.updateMatrixWorld(true);
    walls.push(northWall);

    // South wall (minZ)
    const southGeo = new PlaneGeometry(xSpan, wallHeight);
    const southWall = new Mesh(southGeo, invisMat);
    southWall.position.set(centerX, wallHeight / 2, minZ);
    southWall.updateMatrixWorld(true);
    walls.push(southWall);

    // East wall (maxX)
    const eastGeo = new PlaneGeometry(zSpan, wallHeight);
    const eastWall = new Mesh(eastGeo, invisMat);
    eastWall.position.set(maxX, wallHeight / 2, centerZ);
    eastWall.rotation.y = Math.PI / 2;
    eastWall.updateMatrixWorld(true);
    walls.push(eastWall);

    // West wall (minX)
    const westGeo = new PlaneGeometry(zSpan, wallHeight);
    const westWall = new Mesh(westGeo, invisMat);
    westWall.position.set(minX, wallHeight / 2, centerZ);
    westWall.rotation.y = Math.PI / 2;
    westWall.updateMatrixWorld(true);
    walls.push(westWall);

    for (const wall of walls) {
      game.collider.add(wall);
    }
    wallMeshesRef.current = walls;

    return () => {
      for (const wall of wallMeshesRef.current) {
        game.collider.remove(wall.uuid);
      }
      wallMeshesRef.current = [];
    };
  }, [layout, game?.collider]);

  return null;
}
