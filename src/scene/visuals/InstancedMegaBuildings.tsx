import { useEffect, useRef } from "react";
import { Group } from "three";
import {
  useMegaBuildingInstances,
  type MegaBuildingDescriptor,
} from "./useMegaBuildingInstances";
import type { GameRuntime } from "../../types/game";

type InstancedMegaBuildingsProps = {
  megaBuildings: MegaBuildingDescriptor[];
  game: GameRuntime | null;
};

export function InstancedMegaBuildings({
  megaBuildings,
  game,
}: InstancedMegaBuildingsProps) {
  const groupRef = useRef<Group>(null);
  const meshesAddedRef = useRef(false);
  const { updateInstances, getInstancedMeshes, isReady } =
    useMegaBuildingInstances(game?.assets ?? null);

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

  // Update instances when mega buildings change
  useEffect(() => {
    if (!isReady) {
      return;
    }
    updateInstances(megaBuildings);
  }, [megaBuildings, isReady, updateInstances]);

  return <group ref={groupRef} />;
}

export type { MegaBuildingDescriptor };
