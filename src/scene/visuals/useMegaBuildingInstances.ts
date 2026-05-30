import { useRef, useEffect, useCallback } from "react";
import { InstancedMesh, Matrix4, Object3D } from "three";
import type { BufferGeometry, Material } from "three";

type AssetGetter = {
  getModel: (key: string) => BufferGeometry | undefined;
  getMaterial: (key: string) => Material | Material[] | undefined;
  loaded: boolean;
};

type MegaBuildingDescriptor = {
  modelKey: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotationY: number;
  blockKey: string; // Unique identifier for the city block this belongs to
};

const MEGA_MODEL_KEYS = [
  "mega_01",
  "mega_02",
  "mega_03",
  "mega_04",
  "mega_05",
  "mega_06",
];

// Max instances per model type - mega buildings are rare so this is plenty
const MAX_INSTANCES_PER_MODEL = 50;

export function useMegaBuildingInstances(assets: AssetGetter | null) {
  const instancedMeshesRef = useRef<Map<string, InstancedMesh>>(new Map());
  const instanceCountsRef = useRef<Map<string, number>>(new Map());
  const initializedRef = useRef(false);

  // Temp objects for matrix calculations (reused to avoid allocation)
  const tempObject = useRef(new Object3D());
  const tempMatrix = useRef(new Matrix4());

  // Initialize InstancedMesh objects
  useEffect(() => {
    // Wait for assets to be fully loaded before creating InstancedMesh
    // This ensures textures are available for the material
    if (!assets || !assets.loaded || initializedRef.current) {
      return;
    }

    const material = assets.getMaterial("mega_building_01");
    if (!material) {
      console.warn(
        "useMegaBuildingInstances: mega_building_01 material not found",
      );
      return;
    }

    for (const modelKey of MEGA_MODEL_KEYS) {
      const geometry = assets.getModel(modelKey);
      if (!geometry) {
        console.warn(
          `useMegaBuildingInstances: geometry for ${modelKey} not found`,
        );
        continue;
      }
      const instancedMesh = new InstancedMesh(
        geometry,
        material,
        MAX_INSTANCES_PER_MODEL,
      );
      instancedMesh.count = 0; // Start with no visible instances
      instancedMesh.frustumCulled = false; // We manage visibility ourselves
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      instancedMeshesRef.current.set(modelKey, instancedMesh);
      instanceCountsRef.current.set(modelKey, 0);
    }

    initializedRef.current = true;

    return () => {
      // Cleanup: dispose InstancedMesh objects
      for (const mesh of instancedMeshesRef.current.values()) {
        mesh.dispose();
      }
      instancedMeshesRef.current.clear();
      instanceCountsRef.current.clear();
      initializedRef.current = false;
    };
  }, [assets, assets?.loaded]);

  // Update all instances based on current mega building descriptors
  const updateInstances = useCallback(
    (megaBuildings: MegaBuildingDescriptor[]) => {
      if (!initializedRef.current) {
        return;
      }

      // Group buildings by model key
      const buildingsByModel = new Map<string, MegaBuildingDescriptor[]>();
      for (const modelKey of MEGA_MODEL_KEYS) {
        buildingsByModel.set(modelKey, []);
      }

      for (const building of megaBuildings) {
        const list = buildingsByModel.get(building.modelKey);
        if (list) {
          list.push(building);
        }
      }

      // Update each InstancedMesh
      for (const [modelKey, buildings] of buildingsByModel.entries()) {
        const instancedMesh = instancedMeshesRef.current.get(modelKey);
        if (!instancedMesh) continue;

        const count = Math.min(buildings.length, MAX_INSTANCES_PER_MODEL);
        instancedMesh.count = count;

        for (let i = 0; i < count; i++) {
          const building = buildings[i];
          const obj = tempObject.current;

          // Set transform
          obj.position.set(
            building.position.x,
            building.position.y,
            building.position.z,
          );
          obj.scale.set(building.scale.x, building.scale.y, building.scale.z);
          obj.rotation.set(0, building.rotationY, 0);
          obj.updateMatrix();

          instancedMesh.setMatrixAt(i, obj.matrix);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
      }
    },
    [],
  );

  // Get all InstancedMesh objects for adding to scene
  const getInstancedMeshes = useCallback((): InstancedMesh[] => {
    return Array.from(instancedMeshesRef.current.values());
  }, []);

  return {
    updateInstances,
    getInstancedMeshes,
    isReady: initializedRef.current,
  };
}

export type { MegaBuildingDescriptor };
