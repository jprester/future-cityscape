import { useEffect, useMemo } from "react";
import {
  Mesh,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  MeshBasicMaterial,
} from "three";
import type { Material } from "three";
import { useFrame } from "@react-three/fiber";
import type { GameRuntime } from "../../types/game";
import type { WallAd } from "./types";

/**
 * Renders procedural plane meshes for each WallAd.
 *
 * Wall ads are static, wall-mounted planes (they don't billboard), and the
 * vast majority share a small set of materials with no per-ad overrides — so
 * they're drawn as InstancedMesh, one per material, collapsing what used to be
 * one draw call per ad into one per distinct ad material. Holo ads are
 * additively blended (order-independent), so the lack of per-instance depth
 * sorting is visually invisible.
 *
 * The few ads that need a *cloned* material (emissive/opacity/cutBackground
 * overrides) can't share an instanced mesh, so they fall back to one Mesh each.
 */
function adNeedsOwnMaterial(ad: WallAd): boolean {
  return (
    ad.emissiveIntensityMul !== undefined ||
    ad.emissiveColor !== undefined ||
    ad.opacity !== undefined ||
    ad.cutBackground === true ||
    ad.update !== undefined
  );
}

export function FiniteCityWallAds({
  wallAdStates,
  game,
  visibility,
}: {
  wallAdStates: WallAd[];
  game: GameRuntime | null;
  visibility: { ads: boolean };
}) {
  // Tick per-ad update callbacks (e.g. texture cycling) each frame. Only the
  // individual-mesh fallback ads can carry these.
  useFrame(() => {
    for (const ad of wallAdStates) {
      ad.update?.();
    }
  });

  // Shared unit plane geometry — instances/meshes use scale to set dimensions.
  const planeGeom = useMemo(() => new PlaneGeometry(1, 1), []);
  useEffect(() => () => planeGeom.dispose(), [planeGeom]);

  // Apply an ad's transform to an Object3D (YXZ so the X tilt pitches around
  // the ad's local horizontal axis after the Y face rotation).
  const applyTransform = (obj: Object3D, ad: WallAd) => {
    obj.position.set(ad.x, ad.y, ad.z);
    obj.rotation.order = "YXZ";
    obj.rotation.set(ad.rotationX, ad.rotationY, 0);
    obj.scale.set(ad.width, ad.height, 1);
  };

  // One InstancedMesh per material for all override-free ads.
  const instancedMeshes = useMemo(() => {
    if (!game?.assets?.loaded) return [];

    const byMat = new Map<string, WallAd[]>();
    for (const ad of wallAdStates) {
      if (adNeedsOwnMaterial(ad)) continue;
      let list = byMat.get(ad.matKey);
      if (!list) {
        list = [];
        byMat.set(ad.matKey, list);
      }
      list.push(ad);
    }

    const dummy = new Object3D();
    const meshes: InstancedMesh[] = [];
    for (const [matKey, ads] of byMat) {
      const material = game.assets!.getMaterial(matKey) as Material | undefined;
      if (!material) continue;
      const inst = new InstancedMesh(planeGeom, material, ads.length);
      // City-wide instanced mesh: skip frustum culling (its origin-based bounds
      // would wrongly cull the whole group). Ad planes are 2 triangles each, so
      // drawing off-screen instances is negligible — what we save is draw calls.
      inst.frustumCulled = false;
      for (let i = 0; i < ads.length; i++) {
        applyTransform(dummy, ads[i]);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      meshes.push(inst);
    }
    return meshes;
  }, [wallAdStates, game?.assets?.loaded, planeGeom]);

  useEffect(
    () => () => {
      for (const inst of instancedMeshes) inst.dispose();
    },
    [instancedMeshes],
  );

  // Fallback: one Mesh per ad that needs a cloned (overridden) material.
  const overrideMeshes = useMemo(() => {
    if (!game?.assets?.loaded) return [];
    return wallAdStates
      .filter(adNeedsOwnMaterial)
      .map((ad) => {
        const shared = game.assets!.getMaterial(ad.matKey) as
          | Material
          | undefined;

        let mat: Material | undefined = shared;
        if (shared) {
          const cloned = shared.clone() as Material & {
            emissiveIntensity?: number;
            emissive?: { set: (c: number | string) => void };
            emissiveMap?: unknown;
            alphaMap?: unknown;
            alphaTest?: number;
          };
          if (
            ad.emissiveIntensityMul !== undefined &&
            typeof cloned.emissiveIntensity === "number"
          ) {
            cloned.emissiveIntensity *= ad.emissiveIntensityMul;
          }
          if (ad.emissiveColor !== undefined && cloned.emissive) {
            cloned.emissive.set(ad.emissiveColor);
          }
          if (ad.opacity !== undefined) {
            cloned.opacity = ad.opacity;
          }
          if (ad.cutBackground && cloned.emissiveMap) {
            // Reuse the ad texture as the alpha map — dark pixels become
            // transparent (green channel approximates luminance). alphaTest
            // discards near-black entirely so there's no faint halo.
            cloned.alphaMap = cloned.emissiveMap;
            cloned.alphaTest = ad.alphaTestOverride ?? 0.05;
            cloned.needsUpdate = true;
          }
          mat = cloned;
        }

        const mesh = new Mesh(planeGeom, mat ?? new MeshBasicMaterial());
        applyTransform(mesh, ad);
        return mesh;
      });
  }, [wallAdStates, game?.assets?.loaded, planeGeom]);

  // Dispose the cloned materials when the override meshes are rebuilt.
  useEffect(
    () => () => {
      for (const mesh of overrideMeshes) {
        (mesh.material as Material).dispose();
      }
    },
    [overrideMeshes],
  );

  if (!game?.assets?.loaded || !visibility.ads) return null;

  return (
    <>
      {instancedMeshes.map((m, i) => (
        <primitive key={`inst-${i}`} object={m} />
      ))}
      {overrideMeshes.map((m, i) => (
        <primitive key={`ovr-${i}`} object={m} />
      ))}
    </>
  );
}
