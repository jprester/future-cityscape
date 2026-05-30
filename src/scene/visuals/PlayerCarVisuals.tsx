import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, PointLight, Vector3 } from "three";
import type { Object3D, Material } from "three";
import type { GameRuntime, RuntimePlayer } from "../../types/game";

type PlayerVisuals = {
  car: Object3D | null;
  windows: Object3D | null;
  light: PointLight | null;
};

type PlayerCarVisualsProps = {
  player: RuntimePlayer | null;
  game: GameRuntime | null;
  windshieldShader: string;
};

export function PlayerCarVisuals({
  player,
  game,
  windshieldShader,
}: PlayerCarVisualsProps) {
  const [objects, setObjects] = useState<PlayerVisuals>({
    car: null,
    windows: null,
    light: null,
  });
  const objectsRef = useRef<PlayerVisuals>({
    car: null,
    windows: null,
    light: null,
  });

  useEffect(() => {
    if (!game || !game.assets || !player) {
      return;
    }

    const carPrimitive = new Mesh(game.assets.getModel("spinner"), [
      game.assets.getMaterial("spinner_interior") as Material,
      game.assets.getMaterial("spinner_exterior") as Material,
    ]);
    const windowsMaterial =
      windshieldShader == "advanced"
        ? game.assets.getMaterial("spinner_windows_advanced")
        : game.assets.getMaterial("spinner_windows_simple");
    const windowsObject = new Mesh(
      game.assets.getModel("spinner_windows"),
      windowsMaterial,
    );
    // Interior cockpit light - positioned above dashboard
    const lightObject = new PointLight(0x4488aa, 3, 5);
    lightObject.decay = 2;

    const newObjects = {
      car: carPrimitive,
      windows: windowsObject,
      light: lightObject,
    };
    objectsRef.current = newObjects;
    setObjects(newObjects);

    // Cleanup: Dispose PointLight and clear references
    // Note: We don't dispose geometry/material as they're shared via AssetManager
    return () => {
      if (objectsRef.current.light) {
        objectsRef.current.light.dispose();
      }
      objectsRef.current = { car: null, windows: null, light: null };
    };
  }, [game, player, windshieldShader]);

  useFrame(() => {
    if (!player || !player.carPose) {
      return;
    }
    const pose = player.carPose;
    if (objects.car) {
      objects.car.position.copy(pose.position);
      objects.car.rotation.copy(pose.rotation);
    }
    if (objects.windows) {
      objects.windows.position.copy(pose.position);
      objects.windows.rotation.copy(pose.rotation);
    }
    if (objects.light) {
      // Position light inside cockpit (offset forward and up from car center)
      const offset = new Vector3(0, 0.5, 0.8);
      offset.applyQuaternion(pose.quaternion);
      objects.light.position.copy(pose.position).add(offset);
    }
  }, 1);

  return (
    <group>
      {objects.car ? <primitive object={objects.car} /> : null}
      {objects.windows ? <primitive object={objects.windows} /> : null}
      {objects.light ? <primitive object={objects.light} /> : null}
    </group>
  );
}
