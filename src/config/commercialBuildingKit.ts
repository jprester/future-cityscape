export const COMMERCIAL_ATLAS_MATERIAL_KEY = "commercial_atlas_v1";

export const COMMERCIAL_ATLAS_TEXTURE_KEYS = {
  diffuse: "commercial_atlas_v1_diffuse",
  emissive: "commercial_atlas_v1_emissive",
  roughness: "commercial_atlas_v1_roughness",
  normal: "commercial_atlas_v1_normal",
} as const;

export const COMMERCIAL_ATLAS_TEXTURE_KEY_LIST = Object.values(
  COMMERCIAL_ATLAS_TEXTURE_KEYS,
);
