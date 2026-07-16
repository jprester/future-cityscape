import {
  LoadingManager,
  TextureLoader,
  PlaneGeometry,
  BoxGeometry,
  SphereGeometry,
  Matrix4,
  LinearFilter,
  Color,
} from "three";
import type { Texture, Material, BufferGeometry, Group, Mesh } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type {
  TextureManifest,
  TextureManifestEntry,
  ModelManifest,
  ModelManifestEntry,
  ProceduralGeometryEntry,
  MaterialContext,
  AssetLoadProgress,
  EmissiveMultipliers,
} from "./types";

import { BASE_EMISSIVE_INTENSITIES } from "./types";

import { createTextureManifest } from "./manifests/textures";
import { createModelManifest, detectModelFormat } from "./manifests/models";
import {
  createMaterialFactories,
  type MaterialFactoryMap,
} from "./manifests/materials";

// ── Window emissive tint variation ──────────────────────────────────────────
// Real night cities are dominated by warm interior light with cool/neon as
// accents; tinting every embedded emissive map the same white reads as a
// monochrome synth render. Each embedded building material instead gets a
// deterministic pick from this warm-dominant palette (keyed off the model key,
// so the skyline doesn't reshuffle between loads). Tints are pre-lerped 25%
// toward white so they recolor without muddying emissive maps that already
// carry their own hue.
const WINDOW_TINT_PALETTE: Array<{ color: number; weight: number }> = [
  { color: 0xffc98c, weight: 0.3 }, // warm amber (sodium / interior)
  { color: 0xfff2dc, weight: 0.25 }, // warm white
  { color: 0xd8e8ff, weight: 0.15 }, // cool white
  { color: 0x9fd8ff, weight: 0.15 }, // cyan-blue
  { color: 0xb8ffd9, weight: 0.08 }, // pale green accent
  { color: 0xffb3d9, weight: 0.07 }, // pink accent
];

// Brightness variance range applied on top of the tint. Baked into the
// emissive COLOR (not emissiveIntensity) because updateEmissiveIntensities()
// overwrites intensity from the preset on every preset change.
const WINDOW_BRIGHTNESS_MIN = 0.7;
const WINDOW_BRIGHTNESS_MAX = 1.45;

/** Deterministic 0..1 hash from a string (FNV-1a folded to a float). */
function hash01(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function pickWindowTint(seed: string): Color {
  const roll = hash01(seed);
  let cumulative = 0;
  let picked = WINDOW_TINT_PALETTE[0].color;
  for (const entry of WINDOW_TINT_PALETTE) {
    cumulative += entry.weight;
    if (roll <= cumulative) {
      picked = entry.color;
      break;
    }
  }
  const brightness =
    WINDOW_BRIGHTNESS_MIN +
    hash01(seed + "#b") * (WINDOW_BRIGHTNESS_MAX - WINDOW_BRIGHTNESS_MIN);
  return new Color(picked)
    .lerp(new Color(0xffffff), 0.25)
    .multiplyScalar(brightness);
}

// ── Per-INSTANCE emissive variation ──────────────────────────────────────────
// The palette above varies emissive per MATERIAL, but every InstancedMesh copy
// of a model shares that material — identical twins glow identically, the last
// big "synth render" tell. This shader patch multiplies the emissive by a
// per-instance `instanceEmissive` vec3 attribute (written alongside the
// instance matrices in useBuildingInstances). instanceColor can't do this:
// three only applies it to diffuse. Guarded by USE_INSTANCING so the same
// material on a regular Mesh (asset viewer) compiles to the stock shader and
// is untouched — important because a missing attribute would read as black.
function patchInstanceEmissive(mat: Material): void {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
#ifdef USE_INSTANCING
	attribute vec3 instanceEmissive;
	varying vec3 vInstanceEmissive;
#endif`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
#ifdef USE_INSTANCING
	vInstanceEmissive = instanceEmissive;
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
#ifdef USE_INSTANCING
	varying vec3 vInstanceEmissive;
#endif`,
      )
      .replace(
        "vec3 totalEmissiveRadiance = emissive;",
        `vec3 totalEmissiveRadiance = emissive;
#ifdef USE_INSTANCING
	totalEmissiveRadiance *= vInstanceEmissive;
#endif`,
      );
  };
}

export type AssetManagerConfig = {
  basePath?: string;
  cityBlockSize: number;
  roadWidth: number;
  environment: {
    name: string;
    windowLights: boolean;
  };
  textureAnisotropy?: number;
  terminal?: {
    writeAsset?: (url: string, loaded: number, total: number) => void;
  };
  onLoad?: () => void;
};

export type AssetLoadOptions = {
  /** Omit to load the complete texture manifest (used by the asset viewer). */
  textureKeys?: Iterable<string>;
  /** Omit to load the complete model manifest (used by the asset viewer). */
  modelKeys?: Iterable<string>;
  /** Omit to initialize the complete material-factory catalog. */
  materialKeys?: Iterable<string>;
};

/**
 * Refactored AssetManager with manifest-based loading
 * Supports OBJ, GLB/GLTF formats and lazy material creation
 */
export class AssetManager {
  private basePath: string;
  private textureAnisotropy: number;
  private materialContext: MaterialContext;
  private terminal: AssetManagerConfig["terminal"];
  private onLoadCallback?: () => void;

  // Loaders
  private loadingManager: LoadingManager;
  private textureLoader: TextureLoader;
  private objLoader: OBJLoader;
  private gltfLoader: GLTFLoader;

  // Asset storage
  private textures: Map<string, Texture> = new Map();
  private models: Map<string, BufferGeometry> = new Map();
  private materials: Map<string, Material | Material[]> = new Map();

  // Manifests
  private textureManifest: TextureManifest;
  private modelManifest: ModelManifest;
  private materialFactories: MaterialFactoryMap;
  private materialSelection?: Set<string>;

  // Loading state
  private isLoaded = false;

  constructor(config: AssetManagerConfig) {
    this.basePath = config.basePath ?? "";
    this.textureAnisotropy = config.textureAnisotropy ?? 8;
    this.terminal = config.terminal;
    this.onLoadCallback = config.onLoad;

    this.materialContext = {
      windowLightsEnabled: config.environment.windowLights,
      environmentName: config.environment.name,
      textureAnisotropy: this.textureAnisotropy,
    };

    // Create manifests
    this.textureManifest = createTextureManifest(this.textureAnisotropy);
    this.modelManifest = createModelManifest(
      config.cityBlockSize,
      config.roadWidth,
    );
    this.materialFactories = createMaterialFactories();

    // Initialize loading manager
    this.loadingManager = new LoadingManager();
    this.loadingManager.onProgress = (url, loaded, total) => {
      this.terminal?.writeAsset?.(url, loaded, total);
    };
    this.loadingManager.onLoad = () => {
      console.log("AssetManager: All assets loaded");
      this.isLoaded = true;
      this.initializeMaterials();
      this.onLoadCallback?.();
    };
    this.loadingManager.onError = (url) => {
      console.error(`AssetManager: Failed to load ${url}`);
    };

    // Initialize loaders
    this.textureLoader = new TextureLoader(this.loadingManager);
    this.objLoader = new OBJLoader(this.loadingManager);
    this.gltfLoader = new GLTFLoader(this.loadingManager);
  }

  /**
   * Set the base path for asset loading
   */
  setPath(path: string): void {
    this.basePath = path;
  }

  /**
   * Load all assets defined in manifests
   */
  load(options: AssetLoadOptions = {}): void {
    const textureKeys = options.textureKeys
      ? new Set(options.textureKeys)
      : undefined;
    const modelKeys = options.modelKeys ? new Set(options.modelKeys) : undefined;
    this.materialSelection = options.materialKeys
      ? new Set(options.materialKeys)
      : undefined;

    console.log(
      `AssetManager: Loading ${textureKeys?.size ?? "all"} textures and ` +
        `${modelKeys?.size ?? "all"} models; initializing ` +
        `${this.materialSelection?.size ?? "all"} materials`,
    );

    this.loadTextures(textureKeys);
    this.loadModels(modelKeys);
    this.warnUnknownSelectionKeys(
      "material",
      this.materialSelection,
      this.materialFactories,
    );
  }

  /**
   * Load a single model dynamically (for lazy loading)
   */
  async loadModel(
    key: string,
    entry: ModelManifestEntry,
  ): Promise<BufferGeometry | null> {
    if (this.models.has(key)) {
      return this.models.get(key) ?? null;
    }

    const format = entry.format ?? detectModelFormat(entry.path);
    const fullPath = this.basePath + entry.path;

    try {
      let geometry: BufferGeometry | null = null;

      if (format === "obj") {
        geometry = await this.loadOBJ(fullPath, entry.options);
      } else if (format === "glb" || format === "gltf") {
        geometry = await this.loadGLTF(fullPath, entry.options, key);
      }

      if (geometry) {
        this.models.set(key, geometry);
      }
      return geometry;
    } catch (error) {
      console.error(`AssetManager: Failed to load model ${key}:`, error);
      return null;
    }
  }

  // ===========================================================================
  // Texture Loading
  // ===========================================================================

  private loadTextures(selectedKeys?: Set<string>): void {
    for (const [key, entry] of Object.entries(this.textureManifest)) {
      if (selectedKeys && !selectedKeys.has(key)) continue;
      this.loadTexture(key, entry);
    }
    this.warnUnknownSelectionKeys("texture", selectedKeys, this.textureManifest);
  }

  private loadTexture(key: string, entry: TextureManifestEntry): void {
    const texture = this.textureLoader.load(this.basePath + entry.path);

    // Apply options
    if (entry.options) {
      const opts = entry.options;
      if (opts.colorSpace) texture.colorSpace = opts.colorSpace;
      if (opts.flipY !== undefined) texture.flipY = opts.flipY;
      if (opts.mapping) texture.mapping = opts.mapping;
      if (opts.magFilter) texture.magFilter = opts.magFilter;
      if (opts.wrapS) texture.wrapS = opts.wrapS;
      if (opts.wrapT) texture.wrapT = opts.wrapT;
      if (opts.repeatX || opts.repeatY) {
        texture.repeat.set(opts.repeatX ?? 1, opts.repeatY ?? 1);
      }
      if (opts.anisotropy) texture.anisotropy = opts.anisotropy;
    }

    this.textures.set(key, texture);
  }

  // ===========================================================================
  // Model Loading
  // ===========================================================================

  private loadModels(selectedKeys?: Set<string>): void {
    for (const [key, entry] of Object.entries(this.modelManifest)) {
      if (selectedKeys && !selectedKeys.has(key)) continue;
      if ("type" in entry && entry.format === "geometry") {
        // Procedural geometry
        this.loadProceduralGeometry(key, entry as ProceduralGeometryEntry);
      } else {
        // File-based model
        this.loadModelFromFile(key, entry as ModelManifestEntry);
      }
    }
    this.warnUnknownSelectionKeys("model", selectedKeys, this.modelManifest);
  }

  private warnUnknownSelectionKeys(
    kind: "texture" | "model" | "material",
    selectedKeys: Set<string> | undefined,
    manifest: TextureManifest | ModelManifest | MaterialFactoryMap,
  ): void {
    if (!selectedKeys || !import.meta.env.DEV) return;
    for (const key of selectedKeys) {
      if (!(key in manifest)) {
        console.warn(`AssetManager: Unknown ${kind} key requested: ${key}`);
      }
    }
  }

  private loadProceduralGeometry(
    key: string,
    entry: ProceduralGeometryEntry,
  ): void {
    let geometry: BufferGeometry;

    switch (entry.type) {
      case "plane":
        geometry = new PlaneGeometry(...entry.params);
        break;
      case "box":
        geometry = new BoxGeometry(...entry.params);
        break;
      case "sphere":
        geometry = new SphereGeometry(...entry.params);
        break;
      default:
        console.warn(`AssetManager: Unknown geometry type for ${key}`);
        return;
    }

    this.models.set(key, geometry);
  }

  private loadModelFromFile(key: string, entry: ModelManifestEntry): void {
    const format = entry.format ?? detectModelFormat(entry.path);
    const fullPath = this.basePath + entry.path;

    if (format === "obj") {
      this.objLoader.load(fullPath, (obj) => {
        const geometry = this.extractGeometryFromOBJ(obj, entry.options);
        if (geometry) {
          this.applyGeometryOptions(geometry, entry.options);
          this.models.set(key, geometry);
        }
      });
    } else if (format === "glb" || format === "gltf") {
      this.gltfLoader.load(fullPath, (gltf) => {
        const geometry = this.extractGeometryFromGLTF(gltf, entry.options, key);
        if (geometry) {
          this.applyGeometryOptions(geometry, entry.options);
          this.models.set(key, geometry);
        }
      });
    }
  }

  private extractGeometryFromOBJ(
    obj: Group,
    options?: ModelManifestEntry["options"],
  ): BufferGeometry | null {
    const meshIndex = options?.meshIndex ?? 0;
    const meshName = options?.meshName;

    let targetMesh: Mesh | null = null;

    if (meshName) {
      obj.traverse((child) => {
        if ((child as Mesh).isMesh && child.name === meshName) {
          targetMesh = child as Mesh;
        }
      });
    }

    if (!targetMesh && obj.children[meshIndex]) {
      targetMesh = obj.children[meshIndex] as Mesh;
    }

    return targetMesh?.geometry ?? null;
  }

  private extractGeometryFromGLTF(
    gltf: { scene: Group },
    options?: ModelManifestEntry["options"],
    modelKey?: string,
  ): BufferGeometry | null {
    const meshIndex = options?.meshIndex ?? 0;
    const meshName = options?.meshName;

    let targetMesh: Mesh | null = null;
    const meshes: Mesh[] = [];

    gltf.scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        meshes.push(child as Mesh);
        if (meshName && child.name === meshName) {
          targetMesh = child as Mesh;
        }
      }
    });

    // Multi-mesh GLB with embedded materials: merge all meshes into one
    // geometry with material groups. GLTFLoader creates separate Mesh objects
    // for each material primitive, so we need to recombine them.
    if (
      options?.useEmbeddedMaterial &&
      modelKey &&
      meshes.length > 1 &&
      !meshName
    ) {
      return this.mergeGLTFMeshes(meshes, modelKey);
    }

    if (!targetMesh && meshes[meshIndex]) {
      targetMesh = meshes[meshIndex];
    }

    if (!targetMesh) {
      return null;
    }

    // Apply world matrix to geometry to bake in node transforms (position, rotation, scale)
    // This is important for GLB models that have transforms on their nodes
    targetMesh.updateWorldMatrix(true, false);
    const worldMatrix = targetMesh.matrixWorld;

    // Get the geometry
    let finalGeometry: BufferGeometry;
    const sourceGeometry = targetMesh.geometry;

    if (sourceGeometry) {
      finalGeometry = sourceGeometry.clone();
      finalGeometry.applyMatrix4(worldMatrix);
    } else {
      return null;
    }

    // Store embedded material(s) if requested
    if (options?.useEmbeddedMaterial && modelKey) {
      const embeddedMaterial = targetMesh.material;
      if (embeddedMaterial) {
        const materialKey = `__embedded_${modelKey}`;

        if (Array.isArray(embeddedMaterial)) {
          embeddedMaterial.forEach((mat, i) => {
            this.enhanceEmbeddedMaterial(mat, `${modelKey}:${i}`);
          });
          this.materials.set(materialKey, embeddedMaterial);
        } else {
          this.enhanceEmbeddedMaterial(embeddedMaterial, `${modelKey}:0`);
          this.materials.set(materialKey, embeddedMaterial);
        }
      }
    }

    return finalGeometry;
  }

  /**
   * Merge multiple GLB meshes into a single geometry with material groups.
   * GLTFLoader splits multi-material objects into separate Mesh objects;
   * this recombines them so they can be rendered as one InstancedMesh
   * with a Material[] array.
   */
  private mergeGLTFMeshes(
    meshes: Mesh[],
    modelKey: string,
  ): BufferGeometry | null {
    const geometries: BufferGeometry[] = [];
    const materials: Material[] = [];

    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      geometries.push(geo);

      const mat = mesh.material;
      if (Array.isArray(mat)) {
        materials.push(...mat);
      } else {
        materials.push(mat);
      }
    }

    // Merge with useGroups=true so each input geometry becomes a
    // material group (group index maps to the material array index)
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(
      geometries,
      true,
    );
    if (!mergedGeometry) {
      console.warn(
        `AssetManager: Failed to merge ${meshes.length} meshes for ${modelKey}, ` +
          `falling back to first mesh`,
      );
      return null;
    }

    // Enhance and store all materials
    const materialKey = `__embedded_${modelKey}`;
    materials.forEach((mat, i) => {
      this.enhanceEmbeddedMaterial(mat, `${modelKey}:${i}`);
    });
    this.materials.set(materialKey, materials);

    console.log(
      `AssetManager: Merged ${meshes.length} meshes with ${materials.length} materials for ${modelKey}`,
    );

    return mergedGeometry;
  }

  /**
   * Enhance embedded GLB materials to work better with scene lighting
   * Adjusts PBR properties to make materials more visible in low-light scenes
   */
  private enhanceEmbeddedMaterial(material: Material, tintSeed?: string): void {
    // Check if it's a PBR material (MeshStandardMaterial or MeshPhysicalMaterial)
    if ("roughness" in material && "metalness" in material) {
      const mat = material as any;

      // Add environment map if available and not already set
      if (!mat.envMap) {
        mat.envMap = this.textures.get("env_night");
        mat.envMapIntensity = mat.roughness < 0.4 ? 1.0 : 0.4;
      }

      // Normalize emissive for embedded materials so preset system can control them
      if (mat.emissiveMap && mat.emissiveIntensity !== undefined) {
        // Per-building window tint + brightness from the warm-dominant palette;
        // falls back to neutral white when no seed is available.
        if (tintSeed && mat.emissive?.isColor) {
          mat.emissive.copy(pickWindowTint(tintSeed));
        } else {
          mat.emissive = mat.emissive || 0xffffff;
        }
        // Normalize base intensity to 1.0 - the preset system will multiply this
        // by the category multiplier from BASE_EMISSIVE_INTENSITIES
        mat.emissiveIntensity = 1.0;

        // Disable mipmaps on emissive maps for crisp window lights at distance
        // (mipmaps blur small bright details like window emissions)
        mat.emissiveMap.generateMipmaps = false;
        mat.emissiveMap.minFilter = LinearFilter;
        mat.emissiveMap.magFilter = LinearFilter;
        mat.emissiveMap.needsUpdate = true;

        // Per-instance emissive variation when this material is instanced
        patchInstanceEmissive(material);
      } else if ("emissiveIntensity" in mat) {
        // Even without a map, normalize the intensity for consistent preset control
        mat.emissiveIntensity = 1.0;
      }

      // Apply anisotropic filtering to the surface maps so they don't shimmer /
      // grain at grazing angles or distance (e.g. the rooftop deck receding to
      // the horizon). Set before first upload so it takes effect.
      for (const key of [
        "map",
        "normalMap",
        "roughnessMap",
        "metalnessMap",
        "aoMap",
      ]) {
        const tex = mat[key];
        if (tex) tex.anisotropy = this.textureAnisotropy;
      }
    }

    // Force material to update
    material.needsUpdate = true;
  }

  private applyGeometryOptions(
    geometry: BufferGeometry,
    options?: ModelManifestEntry["options"],
  ): void {
    if (!options) return;

    if (options.rotateX) geometry.rotateX(options.rotateX);
    if (options.rotateY) geometry.rotateY(options.rotateY);
    if (options.rotateZ) geometry.rotateZ(options.rotateZ);
    if (options.scale)
      geometry.scale(options.scale, options.scale, options.scale);

    if (options.computeBVH) {
      // computeBoundsTree is added by three-mesh-bvh
      (geometry as any).computeBoundsTree?.();
    }
  }

  // Async versions for dynamic loading
  private loadOBJ(
    path: string,
    options?: ModelManifestEntry["options"],
  ): Promise<BufferGeometry | null> {
    return new Promise((resolve) => {
      const loader = new OBJLoader();
      loader.load(
        path,
        (obj) => {
          const geometry = this.extractGeometryFromOBJ(obj, options);
          if (geometry) {
            this.applyGeometryOptions(geometry, options);
          }
          resolve(geometry);
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  private loadGLTF(
    path: string,
    options?: ModelManifestEntry["options"],
    modelKey?: string,
  ): Promise<BufferGeometry | null> {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        path,
        (gltf) => {
          const geometry = this.extractGeometryFromGLTF(
            gltf,
            options,
            modelKey,
          );
          if (geometry) {
            this.applyGeometryOptions(geometry, options);
          }
          resolve(geometry);
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  // ===========================================================================
  // Material Creation
  // ===========================================================================

  private initializeMaterials(): void {
    // Materials are created after textures are loaded
    for (const [key, factory] of Object.entries(this.materialFactories)) {
      if (this.materialSelection && !this.materialSelection.has(key)) continue;
      const material = factory(
        (texKey) => this.textures.get(texKey),
        this.materialContext,
      );
      this.materials.set(key, material);
    }
  }

  // ===========================================================================
  // Emissive Intensity Control
  // ===========================================================================

  /**
   * Update emissive intensities on all materials based on preset multipliers
   * This allows dynamic control of glow effects for different visual presets
   */
  updateEmissiveIntensities(multipliers: EmissiveMultipliers): void {
    for (const [key, materialOrArray] of this.materials) {
      const config = BASE_EMISSIVE_INTENSITIES[key];
      if (!config) continue;

      const materials = Array.isArray(materialOrArray)
        ? materialOrArray
        : [materialOrArray];
      for (const material of materials) {
        if ("emissiveIntensity" in material) {
          (material as any).emissiveIntensity =
            config.base * multipliers[config.category];
        }
      }
    }
  }

  // ===========================================================================
  // Public Getters (backward compatible API)
  // ===========================================================================

  getTexture(key: string): Texture | undefined {
    return this.textures.get(key);
  }

  getModel(key: string): BufferGeometry | undefined {
    return this.models.get(key);
  }

  getMaterial(key: string): Material | Material[] | undefined {
    return this.materials.get(key);
  }

  /**
   * Check if all assets are loaded
   */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Get all loaded texture keys
   */
  getTextureKeys(): string[] {
    return Array.from(this.textures.keys());
  }

  /**
   * Get all loaded model keys
   */
  getModelKeys(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Get all loaded material keys
   */
  getMaterialKeys(): string[] {
    return Array.from(this.materials.keys());
  }

  // ===========================================================================
  // Dynamic Asset Management
  // ===========================================================================

  /**
   * Add a texture to the manifest and load it
   */
  addTexture(key: string, entry: TextureManifestEntry): void {
    this.textureManifest[key] = entry;
    this.loadTexture(key, entry);
  }

  /**
   * Add a model to the manifest (call loadModel to actually load it)
   */
  addModelToManifest(key: string, entry: ModelManifestEntry): void {
    this.modelManifest[key] = entry;
  }

  /**
   * Register a custom material factory
   */
  registerMaterialFactory(
    key: string,
    factory: (
      getTexture: (key: string) => Texture | undefined,
      ctx: MaterialContext,
    ) => Material,
  ): void {
    this.materialFactories[key] = factory;
    // Create immediately if textures are loaded
    if (this.isLoaded) {
      const material = factory(
        (texKey) => this.textures.get(texKey),
        this.materialContext,
      );
      this.materials.set(key, material);
    }
  }

  // ===========================================================================
  // Disposal
  // ===========================================================================

  /**
   * Dispose all loaded assets
   */
  dispose(): void {
    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    for (const geometry of this.models.values()) {
      geometry.dispose();
    }
    for (const materialOrArray of this.materials.values()) {
      if (Array.isArray(materialOrArray)) {
        for (const mat of materialOrArray) mat.dispose();
      } else {
        materialOrArray.dispose();
      }
    }

    this.textures.clear();
    this.models.clear();
    this.materials.clear();
  }
}

// =============================================================================
// Backward Compatibility Layer
// =============================================================================

type LegacyGame = {
  cityBlockSize: number;
  roadWidth: number;
  environment: {
    name: string;
    windowLights: boolean;
  };
  onLoad: () => void;
};

type LegacyTerminal = {
  writeAsset?: (url: string, loaded: number, total: number) => void;
};

/**
 * Factory function for backward compatibility with old API
 * Usage: const assets = createAssetManager(game, terminal);
 *
 * This maintains compatibility with the existing Game class while
 * using the new manifest-based AssetManager internally.
 */
export function createAssetManager(
  game: LegacyGame,
  terminal?: LegacyTerminal,
): AssetManager {
  return new AssetManager({
    cityBlockSize: game.cityBlockSize,
    roadWidth: game.roadWidth,
    environment: game.environment,
    terminal,
    onLoad: () => game.onLoad(),
  });
}

/**
 * Legacy-compatible class that wraps the new AssetManager
 * Drop-in replacement for the old AssetManager class
 */
export class LegacyAssetManager {
  private manager: AssetManager;
  private basePath = "";

  constructor(game: LegacyGame, terminal?: LegacyTerminal) {
    this.manager = createAssetManager(game, terminal);
  }

  setPath(path: string): void {
    this.basePath = path;
    this.manager.setPath(path);
  }

  load(options?: AssetLoadOptions): void {
    this.manager.load(options);
  }

  getTexture(key: string) {
    return this.manager.getTexture(key);
  }

  getModel(key: string) {
    return this.manager.getModel(key);
  }

  getMaterial(key: string): Material | Material[] | undefined {
    return this.manager.getMaterial(key);
  }

  updateEmissiveIntensities(multipliers: EmissiveMultipliers): void {
    this.manager.updateEmissiveIntensities(multipliers);
  }

  // Expose loaded state for race condition prevention
  get loaded(): boolean {
    return this.manager.loaded;
  }

  // Expose the underlying manager for advanced usage
  get internal(): AssetManager {
    return this.manager;
  }
}
