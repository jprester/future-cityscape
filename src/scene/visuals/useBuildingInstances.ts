import { useRef, useEffect, useCallback, useState } from "react";
import { InstancedMesh, Object3D } from "three";
import type { BufferGeometry, Material } from "three";
import {
  getAllModelKeys,
  getEmbeddedMaterialKeys,
  getModelRotations,
} from "../../config/buildingRegistry";

type AssetGetter = {
  getModel: (key: string) => BufferGeometry | undefined;
  getMaterial: (key: string) => Material | Material[] | undefined;
  loaded: boolean;
};

export type BuildingDescriptor = {
  modelKey: string;
  materialKey: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotationY: number;
  blockKey: string;
};

// All building model keys — derived from building registry
const BUILDING_MODEL_KEYS = getAllModelKeys();

// All building material keys
const BUILDING_MATERIAL_KEYS = [
  "building_01",
  "building_02",
  "building_03",
  "building_04",
  "building_05",
  "building_06",
  "building_07",
  "building_08",
  "building_09",
  "building_10",
];

// Models that use embedded materials from GLB files — derived from building registry
const MODELS_WITH_EMBEDDED_MATERIALS = getEmbeddedMaterialKeys();

// Per-model default rotation offsets (e.g. to correct orientation from Blender)
const MODEL_ROTATIONS = getModelRotations();

// Max instances per (model, material) combination
const MAX_INSTANCES_PER_COMBO = 150;

// Create a composite key for (model, material) pair
function getComboKey(modelKey: string, materialKey: string): string {
  return `${modelKey}:${materialKey}`;
}

export function useBuildingInstances(assets: AssetGetter | null) {
  const instancedMeshesRef = useRef<Map<string, InstancedMesh>>(new Map());
  const initializedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  // Temp object for matrix calculations (reused to avoid allocation)
  const tempObject = useRef(new Object3D());

  // Initialize InstancedMesh objects for all (model, material) combinations
  useEffect(() => {
    if (!assets || !assets.loaded || initializedRef.current) {
      return;
    }

    // Create InstancedMesh for each possible (model, material) combination
    // We create them lazily - only combinations that are actually used will have instances
    for (const modelKey of BUILDING_MODEL_KEYS) {
      const geometry = assets.getModel(modelKey);
      if (!geometry) {
        console.warn(
          `useBuildingInstances: geometry for ${modelKey} not found`,
        );
        continue;
      }

      // For models with embedded materials (GLB with textures), use the embedded material
      if (MODELS_WITH_EMBEDDED_MATERIALS.has(modelKey)) {
        const embeddedMaterialKey = `__embedded_${modelKey}`;
        const material = assets.getMaterial(embeddedMaterialKey);
        if (!material) {
          console.warn(
            `useBuildingInstances: embedded material for ${modelKey} not found`,
          );
          continue;
        }

        // Create a single InstancedMesh for this model (all instances use the same embedded material)
        // Use a special combo key that maps any material to the embedded one
        const comboKey = getComboKey(modelKey, embeddedMaterialKey);
        const instancedMesh = new InstancedMesh(
          geometry,
          material,
          MAX_INSTANCES_PER_COMBO,
        );
        instancedMesh.count = 0;
        instancedMesh.frustumCulled = false;
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        instancedMeshesRef.current.set(comboKey, instancedMesh);
        continue;
      }

      for (const materialKey of BUILDING_MATERIAL_KEYS) {
        const material = assets.getMaterial(materialKey);
        if (!material) {
          continue;
        }

        const comboKey = getComboKey(modelKey, materialKey);
        const instancedMesh = new InstancedMesh(
          geometry,
          material,
          MAX_INSTANCES_PER_COMBO,
        );
        instancedMesh.count = 0; // Start with no visible instances
        instancedMesh.frustumCulled = false; // We manage visibility ourselves
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        instancedMeshesRef.current.set(comboKey, instancedMesh);
      }
    }

    initializedRef.current = true;
    setIsReady(true);

    return () => {
      // Cleanup: dispose InstancedMesh objects
      for (const mesh of instancedMeshesRef.current.values()) {
        mesh.dispose();
      }
      instancedMeshesRef.current.clear();
      initializedRef.current = false;
      setIsReady(false);
    };
  }, [assets, assets?.loaded]);

  // Update all instances based on current building descriptors
  const updateInstances = useCallback((buildings: BuildingDescriptor[]) => {
    if (!initializedRef.current) {
      return;
    }

    // Group buildings by (model, material) combination
    const buildingsByCombo = new Map<string, BuildingDescriptor[]>();

    for (const building of buildings) {
      // For models with embedded materials, remap to use the embedded material key
      const materialKey = MODELS_WITH_EMBEDDED_MATERIALS.has(building.modelKey)
        ? `__embedded_${building.modelKey}`
        : building.materialKey;
      const comboKey = getComboKey(building.modelKey, materialKey);
      let list = buildingsByCombo.get(comboKey);
      if (!list) {
        list = [];
        buildingsByCombo.set(comboKey, list);
      }
      list.push(building);
    }

    // Update each InstancedMesh
    for (const [
      comboKey,
      instancedMesh,
    ] of instancedMeshesRef.current.entries()) {
      const comboBuildings = buildingsByCombo.get(comboKey) || [];
      const count = Math.min(comboBuildings.length, MAX_INSTANCES_PER_COMBO);
      instancedMesh.count = count;

      if (count === 0) {
        continue;
      }

      for (let i = 0; i < count; i++) {
        const building = comboBuildings[i];
        const obj = tempObject.current;

        // Set transform (apply per-model rotation offset if defined)
        const rot = MODEL_ROTATIONS.get(building.modelKey);
        obj.position.set(
          building.position.x,
          building.position.y,
          building.position.z,
        );
        obj.scale.set(building.scale.x, building.scale.y, building.scale.z);
        obj.rotation.set(
          rot?.x ?? 0,
          building.rotationY + (rot?.y ?? 0),
          rot?.z ?? 0,
        );
        obj.updateMatrix();

        instancedMesh.setMatrixAt(i, obj.matrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }, []);

  // Get all InstancedMesh objects for adding to scene
  const getInstancedMeshes = useCallback((): InstancedMesh[] => {
    return Array.from(instancedMeshesRef.current.values());
  }, []);

  return {
    updateInstances,
    getInstancedMeshes,
    isReady,
  };
}
