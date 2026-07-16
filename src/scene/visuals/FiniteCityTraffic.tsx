import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { BufferGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CITY_BLOCK_SIZE, ROAD_WIDTH } from "../../config/world";
import type { FiniteCityLayout } from "../../config/cityLayouts";
import type { GameRuntime } from "../../types/game";

// Traffic for the finite city, two tiers sharing the same road-grid lanes:
//
//   • FLYING cars — the SynthCity car OBJs (still loaded via the manifest,
//     with the emissive `cars` material) cruising straight lanes at three
//     altitude bands. One InstancedMesh per model (8 draw calls).
//   • GROUND cars — a generated low-poly vertex-colored car (dark body,
//     white head/red tail light bars; no textures — they're a few pixels
//     from the vantage) driving the streets themselves. One InstancedMesh
//     (1 draw call) for the whole fleet; what reads from the roof is the
//     moving head/tail lights down the canyons.
//
// Replaces the orphaned generator-pipeline traffic (GeneratorItem_Traffic)
// with a layout-driven version: positions are a pure function of elapsed
// time, wrapping at the city bounds.

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

// Ground fleet. Scale: 1.6 units/m — the car is ~4.4 m long, lanes sit ~2.8 m
// either side of the road centerline (right-hand traffic).
const GROUND_CARS = 1000;
const GROUND_LANE_OFFSET = 4.5;
const GROUND_SPEED_MIN = 14; // units/s (~31 km/h)
const GROUND_SPEED_MAX = 30;

// Low-poly car: three boxes with vertex colors merged into one geometry —
// near-black body, warm-white headlight bar (+Z, matching the flying models'
// facing), red taillight bar. Rendered with an unlit vertex-colored basic
// material, so the light bars glow against the dark streets without any
// texture or lighting cost.
function paintGeometry(geo: BufferGeometry, r: number, g: number, b: number) {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
}

function makeGroundCarGeometry(): BufferGeometry {
  const body = new BoxGeometry(2.8, 1.7, 7);
  body.translate(0, 0.85, 0);
  paintGeometry(body, 0.03, 0.035, 0.05);

  // Light-bar colors pushed past 1.0 so they cross the bloom threshold and
  // read as glowing dots from the rooftop, not just bright pixels.
  const head = new BoxGeometry(2.3, 0.5, 0.4);
  head.translate(0, 1.0, 3.4);
  paintGeometry(head, 1.5, 1.4, 1.15);

  const tail = new BoxGeometry(2.3, 0.45, 0.35);
  tail.translate(0, 1.05, -3.4);
  paintGeometry(tail, 1.5, 0.12, 0.09);

  const merged = BufferGeometryUtils.mergeGeometries([body, head, tail]);
  body.dispose();
  head.dispose();
  tail.dispose();
  return merged;
}

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
  const { flyingLanes, groundLanes } = useMemo(() => {
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
    if (!xArr.length || !zArr.length)
      return { flyingLanes: [] as CarLane[], groundLanes: [] as CarLane[] };

    const span = layout.bounds.maxX - layout.bounds.minX;

    // Car models (and the generated ground car) face +Z at yaw 0.
    const yawFor = (axis: "x" | "z", dir: 1 | -1) =>
      axis === "x" ? Math.atan2(dir, 0) : Math.atan2(0, dir);

    const rand = mulberry32(1337);
    const flying: CarLane[] = [];
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

      flying.push({
        axis,
        line,
        dir,
        alt,
        speed,
        phase: rand() * span,
        yaw: yawFor(axis, dir),
      });
    }

    // Ground fleet: left-hand traffic (fits the Japanese signage) — the lane
    // sits GROUND_LANE_OFFSET to the travel direction's LEFT of the road
    // centerline, so oncoming lanes stay separated (small jitter so the
    // column doesn't look laser-aligned).
    const grand = mulberry32(7331);
    const ground: CarLane[] = [];
    for (let i = 0; i < GROUND_CARS; i++) {
      const axis: "x" | "z" = grand() < 0.5 ? "x" : "z";
      const lineArr = axis === "x" ? zArr : xArr;
      const dir: 1 | -1 = grand() < 0.5 ? 1 : -1;
      // +X travel keeps -Z to its left; +Z travel keeps +X to its left.
      const side = axis === "x" ? -dir : dir;
      const lateral = side * GROUND_LANE_OFFSET + (grand() - 0.5) * 2;
      const line = lineArr[Math.floor(grand() * lineArr.length)] + lateral;
      ground.push({
        axis,
        line,
        dir,
        alt: 0,
        speed: GROUND_SPEED_MIN + grand() * (GROUND_SPEED_MAX - GROUND_SPEED_MIN),
        phase: grand() * span,
        yaw: yawFor(axis, dir),
      });
    }

    return { flyingLanes: flying, groundLanes: ground };
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

  // Ground fleet mesh — fully owned here (generated geometry + material), so
  // dispose all of it, unlike the flying meshes' shared assets.
  const groundMesh = useMemo(() => {
    if (!groundLanes.length) return null;
    const im = new InstancedMesh(
      makeGroundCarGeometry(),
      new MeshBasicMaterial({ vertexColors: true }),
      groundLanes.length,
    );
    im.frustumCulled = false;
    return im;
  }, [groundLanes]);

  // InstancedMesh owns its instance buffer (the flying meshes' geometry/
  // material are AssetManager-shared) — free what each tier owns.
  useEffect(() => {
    return () => {
      for (const m of meshes) m.dispose();
      if (groundMesh) {
        groundMesh.geometry.dispose();
        (groundMesh.material as MeshBasicMaterial).dispose();
        groundMesh.dispose();
      }
    };
  }, [meshes, groundMesh]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.elapsedTime;
    const { minX, maxX } = layout.bounds;
    const span = maxX - minX;
    const mat = new Matrix4();
    const quat = new Quaternion();
    const pos = new Vector3();
    const scale = new Vector3(1, 1, 1);
    const yAxis = new Vector3(0, 1, 0);

    const place = (mesh: InstancedMesh, index: number, lane: CarLane) => {
      // Travel coordinate wraps across the city span.
      let c = (lane.phase + t * lane.speed) % span;
      if (lane.dir === 1) c = minX + c;
      else c = maxX - c;
      if (lane.axis === "x") pos.set(c, lane.alt, lane.line);
      else pos.set(lane.line, lane.alt, c);
      quat.setFromAxisAngle(yAxis, lane.yaw);
      mat.compose(pos, quat, scale);
      mesh.setMatrixAt(index, mat);
    };

    if (meshes.length && flyingLanes.length) {
      for (let mi = 0; mi < meshes.length; mi++) {
        const mesh = meshes[mi];
        for (let ci = 0; ci < CARS_PER_MODEL; ci++) {
          place(mesh, ci, flyingLanes[(mi * CARS_PER_MODEL + ci) % flyingLanes.length]);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    if (groundMesh) {
      for (let ci = 0; ci < groundLanes.length; ci++) {
        place(groundMesh, ci, groundLanes[ci]);
      }
      groundMesh.instanceMatrix.needsUpdate = true;
    }
  });

  if (!visible) return null;
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
      {groundMesh && <primitive object={groundMesh} />}
    </>
  );
}
