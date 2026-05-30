import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Frustum, Matrix4, Sphere } from "three";
import {
  useBuildingInstances,
  type BuildingDescriptor,
} from "./useBuildingInstances";
import type { GameRuntime } from "../../types/game";

type InstancedBuildingsProps = {
  buildings: BuildingDescriptor[];
  game: GameRuntime | null;
};

// Distance culling is derived from the scene's FogExp2 density: a building is
// dropped once it's far enough that fog obscures it almost completely. At fog
// factor exp(-(density*d)^2), this constant targets ~99.8% fogged. Capped by
// the camera far plane. Thinner fog (day) pushes this past the far plane, so
// distance culling effectively disables itself and frustum culling takes over.
const FOG_CULL_FACTOR = 2.5;
const DEFAULT_FOG_DENSITY = 0.0011;
const DEFAULT_CAMERA_FAR = 2800;

// Inflate each cull sphere slightly so buildings don't pop at the screen edge
// when the camera turns quickly (culling lags rendering by at most one frame).
const FRUSTUM_MARGIN = 1.15;

// Recompute the visible set only once the camera has moved/rotated enough to
// change the result — keeps the per-frame cost near zero when idle.
const MOVE_THRESHOLD_SQ = 1; // ~1 unit
const ROTATE_DOT_THRESHOLD = 0.99995; // ~0.5 degrees

/** Precomputed, rotation-safe world-space bounding sphere for one building. */
type CullEntry = {
  building: BuildingDescriptor;
  cx: number;
  cy: number;
  cz: number;
  radius: number;
};

export function InstancedBuildings({
  buildings,
  game,
}: InstancedBuildingsProps) {
  const groupRef = useRef<Group>(null);
  const meshesAddedRef = useRef(false);
  const { updateInstances, getInstancedMeshes, isReady } =
    useBuildingInstances(game?.assets ?? null);

  // Add InstancedMesh objects to scene once
  useEffect(() => {
    if (!isReady || !groupRef.current || meshesAddedRef.current) {
      return;
    }

    const meshes = getInstancedMeshes();
    for (const mesh of meshes) {
      groupRef.current.add(mesh);
    }
    meshesAddedRef.current = true;

    return () => {
      if (groupRef.current) {
        for (const mesh of meshes) {
          groupRef.current.remove(mesh);
        }
      }
      meshesAddedRef.current = false;
    };
  }, [isReady, getInstancedMeshes]);

  // Precompute a conservative world-space bounding sphere per building.
  // Centered on the building origin in X/Z (so rotationY can never move the
  // geometry out of the sphere) and offset vertically by the geometry's
  // center; the radius covers the geometry radius plus any horizontal center
  // offset, scaled by the instance's largest axis.
  const cullEntries = useMemo<CullEntry[]>(() => {
    const assets = game?.assets;
    if (!assets?.loaded) {
      return [];
    }
    const entries: CullEntry[] = [];
    for (const building of buildings) {
      const geom = assets.getModel(building.modelKey);
      if (!geom) {
        continue;
      }
      if (!geom.boundingSphere) {
        geom.computeBoundingSphere();
      }
      const sphere = geom.boundingSphere;
      if (!sphere) {
        continue;
      }
      const { scale, position } = building;
      const maxScale = Math.max(scale.x, scale.y, scale.z);
      const horizontalOffset = Math.hypot(sphere.center.x, sphere.center.z);
      entries.push({
        building,
        cx: position.x,
        cy: position.y + sphere.center.y * scale.y,
        cz: position.z,
        radius: (sphere.radius + horizontalOffset) * maxScale * FRUSTUM_MARGIN,
      });
    }
    return entries;
  }, [buildings, game?.assets, game?.assets?.loaded]);

  // Reusable scratch objects + last-camera state for the dirty check.
  const frustum = useRef(new Frustum());
  const projScreenMatrix = useRef(new Matrix4());
  const scratchSphere = useRef(new Sphere());
  const dirtyRef = useRef(true);
  const lastCam = useRef({
    x: NaN,
    y: NaN,
    z: NaN,
    qx: 0,
    qy: 0,
    qz: 0,
    qw: 0,
  });

  // Force a re-cull whenever the building set (and thus the bounds) changes.
  useEffect(() => {
    dirtyRef.current = true;
  }, [cullEntries]);

  useFrame(() => {
    if (!isReady) {
      return;
    }
    const camera = game?.player?.camera;
    if (!camera) {
      return;
    }

    // Skip all work if nothing relevant changed since the last cull.
    const p = camera.position;
    const q = camera.quaternion;
    const lc = lastCam.current;
    const movedSq = (p.x - lc.x) ** 2 + (p.y - lc.y) ** 2 + (p.z - lc.z) ** 2;
    const rotDot = Math.abs(
      q.x * lc.qx + q.y * lc.qy + q.z * lc.qz + q.w * lc.qw,
    );
    const moved = !(movedSq <= MOVE_THRESHOLD_SQ); // NaN-safe: true on first run
    const rotated = rotDot < ROTATE_DOT_THRESHOLD;
    if (!dirtyRef.current && !moved && !rotated) {
      return;
    }
    dirtyRef.current = false;
    lc.x = p.x;
    lc.y = p.y;
    lc.z = p.z;
    lc.qx = q.x;
    lc.qy = q.y;
    lc.qz = q.z;
    lc.qw = q.w;

    // Build the camera frustum from this frame's view-projection matrix.
    camera.updateMatrixWorld();
    projScreenMatrix.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    frustum.current.setFromProjectionMatrix(projScreenMatrix.current);

    // Fog-aware draw distance, capped by the camera far plane.
    const fogDensity = game.environment?.fog?.density ?? DEFAULT_FOG_DENSITY;
    const cameraFar = camera.far || DEFAULT_CAMERA_FAR;
    const drawDistance = Math.min(cameraFar, FOG_CULL_FACTOR / fogDensity);
    const drawDistanceSq = drawDistance * drawDistance;

    const sphere = scratchSphere.current;
    const visible: { building: BuildingDescriptor; distSq: number }[] = [];
    for (const e of cullEntries) {
      const dx = e.cx - p.x;
      const dz = e.cz - p.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > drawDistanceSq) {
        continue;
      }
      sphere.center.set(e.cx, e.cy, e.cz);
      sphere.radius = e.radius;
      if (!frustum.current.intersectsSphere(sphere)) {
        continue;
      }
      visible.push({ building: e.building, distSq });
    }

    // Nearest first, so the per-combo instance cap keeps the closest buildings.
    visible.sort((a, b) => a.distSq - b.distSq);
    updateInstances(visible.map((v) => v.building));
  });

  return <group ref={groupRef} />;
}

export type { BuildingDescriptor };
