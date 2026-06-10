import { useRef, useEffect, useCallback, useState } from "react";
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
} from "three";
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

// ── Per-instance emissive variation ─────────────────────────────────────────
// Instanced copies of a model share one embedded material, so without this
// every twin glows with identical windows. Each instance gets a deterministic
// emissive multiplier (brightness + a slight warm↔cool shift) written into an
// `instanceEmissive` vec3 attribute that AssetManager's shader patch reads.
// Seeded from the building's world position so the skyline is stable across
// reloads and re-culls (instance SLOTS reshuffle every camera move, so this is
// rewritten alongside the matrices — it must key off the building, not the slot).
const EMISSIVE_BRIGHTNESS_MIN = 0.55;
const EMISSIVE_BRIGHTNESS_MAX = 1.5;
const EMISSIVE_WARM_COOL_SHIFT = 0.18;

/** Deterministic 0..1 hash from a string (FNV-1a folded to a float). */
function hash01(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const emissiveVariationCache = new WeakMap<
  BuildingDescriptor,
  [number, number, number]
>();

function getEmissiveVariation(
  building: BuildingDescriptor,
): [number, number, number] {
  let v = emissiveVariationCache.get(building);
  if (!v) {
    const seed = `${Math.round(building.position.x)}|${Math.round(building.position.z)}`;
    const brightness =
      EMISSIVE_BRIGHTNESS_MIN +
      hash01(seed) * (EMISSIVE_BRIGHTNESS_MAX - EMISSIVE_BRIGHTNESS_MIN);
    // -1 (cool) .. +1 (warm)
    const warm = (hash01(seed + "#t") - 0.5) * 2;
    v = [
      brightness * (1 + EMISSIVE_WARM_COOL_SHIFT * warm),
      brightness,
      brightness * (1 - EMISSIVE_WARM_COOL_SHIFT * warm),
    ];
    emissiveVariationCache.set(building, v);
  }
  return v;
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
        // Per-instance emissive multiplier, read by the AssetManager shader
        // patch. Lives on the geometry, which is safe here because the
        // embedded path creates exactly one InstancedMesh per model geometry
        // (unlike the OBJ path, where one geometry is shared by 10 meshes).
        if (!geometry.getAttribute("instanceEmissive")) {
          const attr = new InstancedBufferAttribute(
            new Float32Array(MAX_INSTANCES_PER_COMBO * 3).fill(1),
            3,
          );
          attr.setUsage(DynamicDrawUsage);
          geometry.setAttribute("instanceEmissive", attr);
        }
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

      const emissiveAttr = instancedMesh.geometry.getAttribute(
        "instanceEmissive",
      ) as InstancedBufferAttribute | undefined;

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

        if (emissiveAttr) {
          const [r, g, b] = getEmissiveVariation(building);
          emissiveAttr.setXYZ(i, r, g, b);
        }
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      if (emissiveAttr) {
        emissiveAttr.needsUpdate = true;
      }
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
