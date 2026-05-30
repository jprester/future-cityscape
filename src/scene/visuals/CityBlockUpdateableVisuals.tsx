import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh } from "three";
import type { VisibilitySettings } from "../../types/settings";
import type { GameRuntime, UpdateableVisualState } from "../../types/game";

type UpdateableVisualProps = {
  updateable: UpdateableVisualState;
  game: GameRuntime | null;
  visibility: VisibilitySettings;
};

/**
 * Check if an updateable should be visible based on its kind
 */
function isUpdateableVisible(
  kind: UpdateableVisualState["kind"] | undefined,
  visibility: VisibilitySettings,
): boolean {
  switch (kind) {
    case "advert":
      return visibility.ads;
    case "smoke":
      return visibility.smoke;
    case "spotlight":
      return visibility.spotlights;
    case "topper":
      return visibility.toppers;
    default:
      return true;
  }
}

export function CityBlockUpdateableVisuals({
  updateable,
  game,
  visibility,
}: UpdateableVisualProps) {
  const [mesh, setMesh] = useState<Mesh | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const materialKeyRef = useRef<string | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!updateable?.modelKey || !game?.assets) {
      return;
    }

    const materialKey =
      updateable.kind === "advert"
        ? updateable.currentMatKey
        : updateable.matKey;
    const material = materialKey
      ? game.assets.getMaterial(materialKey)
      : null;
    const object = new Mesh(
      game.assets.getModel(updateable.modelKey),
      material || undefined,
    );

    if (updateable.position) {
      object.position.set(
        updateable.position.x,
        updateable.position.y,
        updateable.position.z,
      );
    }
    if (updateable.scale) {
      object.scale.set(updateable.scale.x, updateable.scale.y, updateable.scale.z);
    }
    if (typeof updateable.rotationY === "number") {
      object.rotation.y = updateable.rotationY;
    }

    materialKeyRef.current = materialKey || null;
    meshRef.current = object;
    setMesh(object);

    // Cleanup: Clear mesh reference to allow garbage collection
    // Note: We don't dispose geometry/material as they're shared via AssetManager
    return () => {
      meshRef.current = null;
      materialKeyRef.current = null;
    };
  }, [updateable, game]);

  useFrame(() => {
    if (!mesh || !updateable) {
      return;
    }

    if (updateable.position) {
      mesh.position.set(
        updateable.position.x,
        updateable.position.y,
        updateable.position.z,
      );
    }
    if (updateable.scale) {
      mesh.scale.set(updateable.scale.x, updateable.scale.y, updateable.scale.z);
    }

    if (updateable.kind === "topper") {
      mesh.rotation.y = updateable.rotationY ?? mesh.rotation.y;
    } else if (typeof updateable.rotationY === "number") {
      mesh.rotation.y = updateable.rotationY;
    }

    if (updateable.kind === "advert") {
      const desiredKey = updateable.currentMatKey;
      if (desiredKey && desiredKey !== materialKeyRef.current) {
        mesh.material = game.assets.getMaterial(desiredKey);
        materialKeyRef.current = desiredKey;
      }
    }

    if (updateable.kind === "smoke") {
      mesh.lookAt(camera.position);
      mesh.rotation.x += Math.cos(updateable.rstep || 0) * 0.25;
    }

    if (updateable.kind === "spotlight") {
      mesh.lookAt(camera.position);
      mesh.rotation.x += Math.cos(updateable.rstep || 0) * 0.4;
    }
  }, 1);

  // Check visibility based on updateable kind
  if (!isUpdateableVisible(updateable.kind, visibility)) {
    return null;
  }

  return mesh ? <primitive object={mesh} /> : null;
}
