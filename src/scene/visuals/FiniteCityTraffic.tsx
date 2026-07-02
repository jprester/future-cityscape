import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { CITY_BLOCK_SIZE, ROAD_WIDTH } from "../../config/world";
import type { FiniteCityLayout } from "../../config/cityLayouts";
import type { GameRuntime } from "../../types/game";

// Flying traffic for the finite city: the SynthCity car OBJs (still loaded via
// the manifest, with the emissive `cars` material) cruising straight lanes
// along the road grid at three altitude bands. Replaces the orphaned
// generator-pipeline traffic (GeneratorItem_Traffic) with a layout-driven
// version: one InstancedMesh per car model (8 draw calls total), positions are
// a pure function of elapsed time, wrapping at the city bounds.

const CAR_MODEL_KEYS = [
  "car_01",
  "car_02",
  "car_03",
  "car_04",
  "car_05",
  "car_06",
  "car_07",
  "car_08",
];
const CARS_PER_MODEL = 8;

// Deterministic PRNG (mulberry32) so the traffic pattern is stable per seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type CarLane = {
  axis: "x" | "z"; // travel axis
  line: number; // road centerline on the OTHER axis (+ lateral offset)
  dir: 1 | -1;
  alt: number;
  speed: number; // units/second
  phase: number; // start offset along the lane
  yaw: number;
};

export function FiniteCityTraffic({
  layout,
  game,
  visible,
}: {
  layout: FiniteCityLayout;
  game: GameRuntime | null;
  visible: boolean;
}) {
  const assets = game?.assets;
  const assetsLoaded = Boolean(assets?.loaded);

  // Road centerlines sit CITY_BLOCK_SIZE/2 + ROAD_WIDTH/2 outside each block
  // center; collect the unique lines from the layout's ground tiles so lanes
  // follow real streets on any layout (generated or JSON-loaded).
  const lanes = useMemo<CarLane[]>(() => {
    const off = CITY_BLOCK_SIZE / 2 + ROAD_WIDTH / 2;
    const xLines = new Set<number>();
    const zLines = new Set<number>();
    for (const t of layout.groundTiles) {
      xLines.add(t.x - off);
      xLines.add(t.x + off);
      zLines.add(t.z - off);
      zLines.add(t.z + off);
    }
    const xArr = [...xLines];
    const zArr = [...zLines];
    if (!xArr.length || !zArr.length) return [];

    const rand = mulberry32(1337);
    const span = layout.bounds.maxX - layout.bounds.minX;
    const out: CarLane[] = [];
    for (let i = 0; i < CAR_MODEL_KEYS.length * CARS_PER_MODEL; i++) {
      const axis: "x" | "z" = rand() < 0.5 ? "x" : "z";
      const lineArr = axis === "x" ? zArr : xArr; // fixed coord is on the other axis
      const lateral = (rand() - 0.5) * (ROAD_WIDTH - 8);
      const line = lineArr[Math.floor(rand() * lineArr.length)] + lateral;
      const dir: 1 | -1 = rand() < 0.5 ? 1 : -1;

      // Altitude bands: mostly canyon-level (below commercial rooflines), some
      // among the towers, a few high overflights near the vantage height.
      const band = rand();
      let alt: number;
      let speed: number;
      if (band < 0.6) {
        alt = 25 + rand() * 70;
        speed = 30 + rand() * 25;
      } else if (band < 0.9) {
        alt = 140 + rand() * 160;
        speed = 50 + rand() * 30;
      } else {
        alt = 320 + rand() * 130;
        speed = 65 + rand() * 25;
      }

      // Car models face +Z at yaw 0; yaw = atan2(vx, vz).
      const yaw =
        axis === "x" ? Math.atan2(dir, 0) : Math.atan2(0, dir === 1 ? 1 : -1);

      out.push({ axis, line, dir, alt, speed, phase: rand() * span, yaw });
    }
    return out;
  }, [layout]);

  const meshes = useMemo(() => {
    if (!assetsLoaded || !assets) return [];
    const out: InstancedMesh[] = [];
    const material = assets.getMaterial("cars");
    if (!material) return out;
    for (const key of CAR_MODEL_KEYS) {
      const geometry = assets.getModel(key);
      if (!geometry) continue;
      const im = new InstancedMesh(geometry, material, CARS_PER_MODEL);
      // Instances spread across the whole city and move every frame; skip the
      // per-batch bounding-sphere culling rather than recomputing it.
      im.frustumCulled = false;
      out.push(im);
    }
    return out;
  }, [assets, assetsLoaded]);

  // InstancedMesh owns its instance buffer (geometry/material are
  // AssetManager-shared) — free just that on rebuild/unmount.
  useEffect(() => {
    return () => {
      for (const m of meshes) m.dispose();
    };
  }, [meshes]);

  useFrame(({ clock }) => {
    if (!visible || !meshes.length || !lanes.length) return;
    const t = clock.elapsedTime;
    const { minX, maxX } = layout.bounds;
    const span = maxX - minX;
    const mat = new Matrix4();
    const quat = new Quaternion();
    const pos = new Vector3();
    const scale = new Vector3(1, 1, 1);
    const yAxis = new Vector3(0, 1, 0);

    for (let mi = 0; mi < meshes.length; mi++) {
      const mesh = meshes[mi];
      for (let ci = 0; ci < CARS_PER_MODEL; ci++) {
        const lane = lanes[(mi * CARS_PER_MODEL + ci) % lanes.length];
        // Travel coordinate wraps across the city span.
        let c = (lane.phase + t * lane.speed) % span;
        if (lane.dir === 1) c = minX + c;
        else c = maxX - c;
        if (lane.axis === "x") pos.set(c, lane.alt, lane.line);
        else pos.set(lane.line, lane.alt, c);
        quat.setFromAxisAngle(yAxis, lane.yaw);
        mat.compose(pos, quat, scale);
        mesh.setMatrixAt(ci, mat);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  if (!visible) return null;
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  );
}
