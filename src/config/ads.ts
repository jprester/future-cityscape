// ============================================================================
// Ad assets — single source of truth
// ============================================================================
//
// Every ad image lives in `public/assets/textures/ads/ad_NN.jpg` (zero-padded).
// One row in ADS_META below = one image. The texture manifest, material
// factories, emissive-intensity table, and aspect-bucket helpers are all
// derived from this array.
//
// Adding a new ad:
//   1. Drop `ad_NN.jpg` into public/assets/textures/ads/
//   2. Add an entry to ADS_META with the matching id
//   3. Done — both `ad_holo_NN` and `ad_billboard_NN` materials auto-register
//
// Style variants applied to the SAME image:
//   • holo      → semi-transparent additive hologram (default for wall ads)
//   • billboard → opaque self-illuminated LED panel
//
// (Future styles can extend AdStyle without changing any consumers — just add
//  a new factory in materials.ts and a matching BASE_EMISSIVE_INTENSITIES row.)

export type AdStyle = "holo" | "billboard";

export type AdMeta = {
  /** Stable numeric id, matches the `ad_NN.jpg` filename. */
  id: number;
  /** Native width / height ratio of the source image. Used to size the
   *  rendered plane so the image isn't squashed. */
  aspect: number;
  /** Short human label — purely for the layout console.table + comments. */
  label: string;
};

export const ADS_META: readonly AdMeta[] = [
  { id: 1, aspect: 964 / 1280, label: "ninja (portrait)" },
  { id: 2, aspect: 1, label: "Sengoku icon (square)" },
  { id: 3, aspect: 853 / 1280, label: "pixel koi (portrait)" },
  { id: 4, aspect: 964 / 1280, label: "calligraphy (portrait)" },
  { id: 5, aspect: 1280 / 717, label: "cdbj (16:9 landscape)" },
  { id: 6, aspect: 1280 / 900, label: "teal gradient (~3:2 landscape)" },
  { id: 7, aspect: 1, label: "cyberpunk visual (square)" },
  { id: 8, aspect: 1280 / 717, label: "retrowave (16:9 landscape)" },
  { id: 9, aspect: 1, label: "ramen poster (square)" },
  // id: 10 — reserved (dragon logo, source missing on disk)
  { id: 11, aspect: 1, label: "image-1812 (square)" },
  { id: 12, aspect: 320 / 1280, label: "neon Japanese banner (1:4 tall)" },
  { id: 13, aspect: 853 / 1280, label: "Geisha poster (portrait)" },
  { id: 14, aspect: 1280 / 853, label: "0_1 (~3:2 landscape)" },
  { id: 15, aspect: 1280 / 717, label: "rajupaq R&B (16:9 landscape)" },
  { id: 16, aspect: 1280 / 853, label: "holographic letters (~3:2)" },
  { id: 17, aspect: 1280 / 717, label: "energy drink (16:9 landscape)" },
] as const;

// ── Key helpers ────────────────────────────────────────────────────────────
// Centralizing the naming convention here means manifests, factories, and the
// wall-ad renderer all agree on how a numeric id maps to a string key.

const pad = (n: number): string => n.toString().padStart(2, "0");

/** Texture key, matches the JPG filename in textures/ads/. */
export const adTextureKey = (id: number): string => `ad_${pad(id)}`;

/** Material key for a specific style of a specific ad. */
export const adMatKey = (id: number, style: AdStyle): string =>
  `ad_${style}_${pad(id)}`;

/** Find metadata for an ad id, returns undefined if unknown. */
export function findAdMeta(id: number): AdMeta | undefined {
  return ADS_META.find((m) => m.id === id);
}
