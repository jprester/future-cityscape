import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, Group, Object3D } from "three";
import { useTrafficCarPool } from "./useTrafficCarPool";
import type { GameRuntime, TrafficCarState, TrafficItemState, WithGenId } from "../../types/game";

type PooledTrafficVisualsProps = {
  trafficItems: Array<WithGenId<TrafficItemState>>;
  game: GameRuntime | null;
};

type PooledMesh = Mesh & { __poolKey?: string };

export function PooledTrafficVisuals({
  trafficItems,
  game,
}: PooledTrafficVisualsProps) {
  const groupRef = useRef<Group>(null);
  const assignmentsRef = useRef<Map<TrafficCarState, PooledMesh>>(new Map());
  const { acquire, release, getAllMeshes, isReady } = useTrafficCarPool(
    game?.assets ?? null,
  );
  const meshesAddedRef = useRef(false);

  // Add all pool meshes to scene once
  useEffect(() => {
    if (!isReady || !groupRef.current || meshesAddedRef.current) {
      return;
    }

    const allMeshes = getAllMeshes();
    for (const mesh of allMeshes) {
      groupRef.current.add(mesh);
    }
    meshesAddedRef.current = true;

    return () => {
      if (groupRef.current) {
        for (const mesh of allMeshes) {
          groupRef.current.remove(mesh);
        }
      }
      meshesAddedRef.current = false;
    };
  }, [isReady, getAllMeshes]);

  // Manage mesh assignments when traffic items change
  useEffect(() => {
    if (!isReady) {
      return;
    }

    const currentAssignments = assignmentsRef.current;
    const newCars = new Set<TrafficCarState>();

    // Collect all current cars
    for (const item of trafficItems) {
      for (const car of item.cars || []) {
        newCars.add(car);
      }
    }

    // Release meshes for cars that no longer exist
    for (const [car, mesh] of currentAssignments.entries()) {
      if (!newCars.has(car)) {
        release(mesh);
        currentAssignments.delete(car);
      }
    }

    // Acquire meshes for new cars
    for (const car of newCars) {
      if (!currentAssignments.has(car)) {
        const mesh = acquire(car.modelKey);
        if (mesh) {
          currentAssignments.set(car, mesh);
          // Set initial rotation from car pose
          if (car.pose) {
            mesh.rotation.copy(car.pose.rotation);
          }
        }
      }
    }
  }, [trafficItems, isReady, acquire, release]);

  // Update mesh transforms every frame
  useFrame(() => {
    const assignments = assignmentsRef.current;

    for (const [car, mesh] of assignments.entries()) {
      if (car.pose) {
        mesh.position.copy(car.pose.position);
        mesh.rotation.copy(car.pose.rotation);
      }
    }
  }, 1);

  return <group ref={groupRef} />;
}
