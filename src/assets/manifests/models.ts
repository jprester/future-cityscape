import type { ModelManifest } from "../types";
import {
  getBuildingManifestEntries,
  getAllAdModelKeys,
} from "../../config/buildingRegistry";

/**
 * Model manifest - defines all 3D models to be loaded
 * Supports: .obj, .glb, .gltf, and procedural geometries
 *
 * Format auto-detected from file extension, or specify explicitly:
 * { path: 'model.glb', format: 'glb', options: { computeBVH: true } }
 */
export function createModelManifest(
  cityBlockSize: number,
  roadWidth: number,
): ModelManifest {
  const manifest: ModelManifest = {
    // Player car (spinner)
    spinner: {
      path: "models/spinner.obj",
      options: { rotateY: -Math.PI / 2 },
    },
    spinner_windows: {
      path: "models/spinner_windows.obj",
      options: { rotateY: -Math.PI / 2 },
    },

    // Ground plane (procedural)
    ground: {
      type: "plane",
      params: [cityBlockSize + roadWidth, cityBlockSize + roadWidth],
      format: "geometry",
    },

    // Smoke plane (procedural)
    smoke: {
      type: "plane",
      params: [64, 64],
      format: "geometry",
    },

    // Storefronts
    storefronts: {
      path: "models/storefronts.obj",
      options: { computeBVH: true },
    },

    // Spotlight
    spotlight: {
      path: "models/spotlight.obj",
    },
  };

  // Buildings — derived from building registry (single source of truth)
  Object.assign(manifest, getBuildingManifestEntries());

  // Mega buildings (6 variants)
  for (let i = 1; i <= 6; i++) {
    const id = i.toString().padStart(2, "0");
    manifest[`mega_${id}`] = {
      path: `models/mega_${id}.obj`,
      options: { computeBVH: true },
    };
  }

  // Advertisement models — derived from building registry
  for (const key of getAllAdModelKeys()) {
    manifest[key] = { path: `models/${key}.obj` };
  }

  // Toppers (12 variants) — kept available for future hand-placed toppers,
  // even though procedural spawning has been removed from the scene.
  for (let i = 1; i <= 12; i++) {
    const id = i.toString().padStart(2, "0");
    manifest[`topper_${id}`] = { path: `models/topper_${id}.obj` };
  }

  // Traffic cars (8 variants)
  for (let i = 1; i <= 8; i++) {
    const id = i.toString().padStart(2, "0");
    manifest[`car_${id}`] = { path: `models/car_${id}.obj` };
  }

  return manifest;
}

/**
 * Helper to add a GLB model to an existing manifest
 * Use this for adding new models in GLB format
 */
export function addGLBModel(
  manifest: ModelManifest,
  key: string,
  path: string,
  options?: {
    computeBVH?: boolean;
    meshName?: string;
    meshIndex?: number;
    scale?: number;
  },
): void {
  manifest[key] = {
    path,
    format: "glb",
    options,
  };
}

/**
 * Helper to detect format from file extension
 */
export function detectModelFormat(path: string): "obj" | "glb" | "gltf" {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "glb":
      return "glb";
    case "gltf":
      return "gltf";
    case "obj":
    default:
      return "obj";
  }
}
