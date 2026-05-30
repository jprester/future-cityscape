import { useEffect, useMemo } from "react";
import { Mesh, PlaneGeometry, MeshBasicMaterial } from "three";
import type { Material } from "three";
import { useFrame } from "@react-three/fiber";
import type { GameRuntime } from "../../types/game";
import type { WallAd } from "./types";

/**
 * Renders procedural plane meshes for each WallAd. Each ad becomes one
 * Mesh sharing a single unit PlaneGeometry, scaled to (width, height) and
 * rotated to face outward. Materials are looked up by matKey from the asset
 * manager; when an ad has per-entry material overrides, the material is
 * cloned so the tweak doesn't bleed to other ads using the same matKey.
 */
export function FiniteCityWallAds({
  wallAdStates,
  game,
  visibility,
}: {
  wallAdStates: WallAd[];
  game: GameRuntime | null;
  visibility: { ads: boolean };
}) {
  // Tick per-ad update callbacks (e.g. texture cycling) each frame.
  useFrame(() => {
    for (const ad of wallAdStates) {
      ad.update?.();
    }
  });

  // Shared unit plane geometry — meshes use scale to set actual dimensions.
  const planeGeom = useMemo(() => new PlaneGeometry(1, 1), []);
  useEffect(() => () => planeGeom.dispose(), [planeGeom]);

  // Build one Mesh per wall ad. Clones materials only when an entry asks
  // for an override; otherwise the shared instance is reused.
  const meshes = useMemo(() => {
    if (!game?.assets?.loaded) return [];
    return wallAdStates.map((ad) => {
      const shared = game.assets!.getMaterial(ad.matKey) as
        | Material
        | undefined;
      if (shared) shared.name = ad.matKey;

      const hasOverride =
        ad.emissiveIntensityMul !== undefined ||
        ad.emissiveColor !== undefined ||
        ad.opacity !== undefined ||
        ad.cutBackground === true;

      let mat: Material | undefined = shared;
      if (shared && hasOverride) {
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
      mesh.position.set(ad.x, ad.y, ad.z);
      // YXZ order so the X tilt happens around the ad's local horizontal
      // axis (after the Y face rotation), giving an intuitive pitch motion.
      mesh.rotation.order = "YXZ";
      mesh.rotation.set(ad.rotationX, ad.rotationY, 0);
      mesh.scale.set(ad.width, ad.height, 1);
      return mesh;
    });
  }, [wallAdStates, game?.assets?.loaded, planeGeom]);

  // Sync material when ad.matKey changes (texture cycling).
  useFrame(() => {
    if (!game?.assets?.loaded) return;
    for (let i = 0; i < wallAdStates.length; i++) {
      const ad = wallAdStates[i];
      const mesh = meshes[i];
      if (!mesh) continue;
      const currentName = (mesh.material as Material).name;
      if (currentName !== ad.matKey) {
        const next = game.assets!.getMaterial(ad.matKey) as
          | Material
          | undefined;
        if (next) {
          next.name = ad.matKey;
          mesh.material = next;
        }
      }
    }
  });

  if (!game?.assets?.loaded || !visibility.ads) return null;

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}
