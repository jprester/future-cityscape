import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import type { Object3D } from "three";
import type { GameRuntime, TrafficCarState } from "../../types/game";

type TrafficCarVisualsProps = {
  car: TrafficCarState;
  game: GameRuntime | null;
};

export function TrafficCarVisuals({ car, game }: TrafficCarVisualsProps) {
  const [mesh, setMesh] = useState<Object3D | null>(null);
  const meshRef = useRef<Object3D | null>(null);

  useEffect(() => {
    if (!car || !game?.assets) {
      return;
    }
    const carMesh = new Mesh(
      game.assets.getModel(car.modelKey),
      game.assets.getMaterial("cars"),
    );
    meshRef.current = carMesh;
    setMesh(carMesh);

    // Cleanup: Clear mesh reference to allow garbage collection
    // Note: We don't dispose geometry/material as they're shared via AssetManager
    return () => {
      meshRef.current = null;
    };
  }, [car, game]);

  useFrame(() => {
    if (!car?.pose || !mesh) {
      return;
    }
    mesh.position.copy(car.pose.position);
    mesh.rotation.copy(car.pose.rotation);
  }, 1);

  return mesh ? <primitive object={mesh} /> : null;
}
