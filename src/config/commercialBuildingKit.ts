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

export const COMMERCIAL_INDUSTRIAL_MATERIAL_KEY = "commercial_industrial_v2";

export const COMMERCIAL_INDUSTRIAL_TEXTURE_KEYS = {
  diffuse: "commercial_industrial_v2_diffuse",
  emissive: "commercial_industrial_v2_emissive",
  roughness: "commercial_industrial_v2_roughness",
  normal: "commercial_industrial_v2_normal",
} as const;

export const COMMERCIAL_INDUSTRIAL_TEXTURE_KEY_LIST = Object.values(
  COMMERCIAL_INDUSTRIAL_TEXTURE_KEYS,
);
