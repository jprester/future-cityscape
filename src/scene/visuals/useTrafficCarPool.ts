import { useRef, useCallback, useEffect, useState } from "react";
import { Mesh } from "three";
import type { BufferGeometry, Material } from "three";

type PooledMesh = Mesh & { __poolKey?: string };

type CarMeshPool = {
  available: Map<string, PooledMesh[]>;
  inUse: Set<PooledMesh>;
};

type AssetGetter = {
  getModel: (key: string) => BufferGeometry | undefined;
  getMaterial: (key: string) => Material | Material[] | undefined;
  loaded?: boolean;
};

const CAR_MODEL_KEYS = [
  "car_01",
  "car_02",
  "car_03",
  "car_04",
  "car_05",
  "car_06",
  "car_07",
  "car_08",
];

const POOL_SIZE_PER_MODEL = 15;

export function useTrafficCarPool(assets: AssetGetter | null) {
  const poolRef = useRef<CarMeshPool>({
    available: new Map(),
    inUse: new Set(),
  });
  const initializedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  // Initialize pool with pre-allocated meshes
  useEffect(() => {
    // Already initialized - don't re-run
    if (initializedRef.current) {
      return;
    }

    // Wait until assets exist AND are fully loaded
    if (!assets || !assets.loaded) {
      return;
    }

    const pool = poolRef.current;
    const carsMaterial = assets.getMaterial("cars");

    // Defensive check: ensure material exists before creating meshes
    if (!carsMaterial) {
      console.warn("useTrafficCarPool: cars material not found, waiting...");
      return;
    }

    for (const modelKey of CAR_MODEL_KEYS) {
      const geometry = assets.getModel(modelKey);

      // Defensive check: ensure geometry exists
      if (!geometry) {
        console.warn(`useTrafficCarPool: geometry for ${modelKey} not found, skipping`);
        continue;
      }

      const meshes: PooledMesh[] = [];
      for (let i = 0; i < POOL_SIZE_PER_MODEL; i++) {
        const mesh = new Mesh(geometry, carsMaterial) as PooledMesh;
        mesh.__poolKey = modelKey;
        mesh.visible = false;
        meshes.push(mesh);
      }

      pool.available.set(modelKey, meshes);
    }

    initializedRef.current = true;
    setIsReady(true);

    // Cleanup: Clear pool on unmount
    return () => {
      pool.available.clear();
      pool.inUse.clear();
      initializedRef.current = false;
      setIsReady(false);
    };
  }, [assets, assets?.loaded]);

  // Acquire a mesh from the pool for a given model
  const acquire = useCallback((modelKey: string): PooledMesh | null => {
    const pool = poolRef.current;
    const availableList = pool.available.get(modelKey);

    if (!availableList || availableList.length === 0) {
      // Pool exhausted - this shouldn't happen with proper sizing
      // In production, could dynamically allocate here
      return null;
    }

    const mesh = availableList.pop()!;
    mesh.visible = true;
    pool.inUse.add(mesh);
    return mesh;
  }, []);

  // Release a mesh back to the pool
  const release = useCallback((mesh: PooledMesh) => {
    const pool = poolRef.current;

    if (!pool.inUse.has(mesh)) {
      return;
    }

    pool.inUse.delete(mesh);
    mesh.visible = false;
    // Reset transform to avoid stale state
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);

    const modelKey = mesh.__poolKey;
    if (modelKey) {
      const availableList = pool.available.get(modelKey);
      if (availableList) {
        availableList.push(mesh);
      }
    }
  }, []);

  // Get all meshes (for adding to scene)
  const getAllMeshes = useCallback((): PooledMesh[] => {
    const pool = poolRef.current;
    const allMeshes: PooledMesh[] = [];

    for (const meshes of pool.available.values()) {
      allMeshes.push(...meshes);
    }
    allMeshes.push(...pool.inUse);

    return allMeshes;
  }, []);

  return {
    acquire,
    release,
    getAllMeshes,
    isReady,
  };
}
