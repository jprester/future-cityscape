// Asset management system
export {
  AssetManager,
  LegacyAssetManager,
  createAssetManager,
} from "./AssetManager";
export type { AssetManagerConfig } from "./AssetManager";

// Types
export type {
  TextureManifest,
  TextureManifestEntry,
  TextureOptions,
  ModelManifest,
  ModelManifestEntry,
  ModelFormat,
  ModelOptions,
  ProceduralGeometryEntry,
  MaterialDefinition,
  MaterialType,
  MaterialContext,
  MaterialFactory,
  AssetLoadProgress,
  LoadedAssets,
} from "./types";

// Manifests (for customization)
export { createTextureManifest } from "./manifests/textures";
export { createModelManifest, addGLBModel, detectModelFormat } from "./manifests/models";
export { createMaterialFactories } from "./manifests/materials";
