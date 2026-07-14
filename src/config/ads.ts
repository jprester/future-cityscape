// ============================================================================
// Ad assets — single source of truth
// ============================================================================
//
// Runtime ad images live in `public/assets/textures/ads-v2/`; their full-size
// generated sources live in `art-source/textures/ads-v2/`. One row in ADS_META
// below = one image. The texture manifest, material factories,
// emissive-intensity table, and aspect-bucket helpers are all derived from this
// array. The superseded v1 files remain on disk as source/reference art but are
// intentionally absent from the runtime pool.
//
// Adding a new ad:
//   1. Export a size-capped WebP into public/assets/textures/ads-v2/
//   2. Add an entry to ADS_META with a stable id and matching filename
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
  /** Stable numeric id used for texture/material keys. */
  id: number;
  /** Runtime WebP filename inside textures/ads-v2/. */
  file: string;
  /** Native width / height ratio of the source image. Used to size the
   *  rendered plane so the image isn't squashed. */
  aspect: number;
  /** Short human label — purely for the layout console.table + comments. */
  label: string;
};

export const ADS_META: readonly AdMeta[] = [
  { id: 18, file: "kitsune.webp", aspect: 1, label: "Kitsune transit" },
  { id: 19, file: "orbit-ramen.webp", aspect: 1, label: "Orbit Ramen" },
  { id: 20, file: "aero-9.webp", aspect: 1, label: "Aero-9 footwear" },
  { id: 21, file: "mori-synth.webp", aspect: 1, label: "Mori Synth" },
  {
    id: 22,
    file: "neon-runner.webp",
    aspect: 2 / 3,
    label: "Neon Runner courier",
  },
  { id: 23, file: "luna-tea.webp", aspect: 2 / 3, label: "Luna Tea" },
  {
    id: 24,
    file: "kuro-arcade.webp",
    aspect: 2 / 3,
    label: "Kuro Arcade",
  },
  { id: 25, file: "nightline.webp", aspect: 3 / 2, label: "Nightline rail" },
  { id: 26, file: "volt-cola.webp", aspect: 3 / 2, label: "Volt Cola" },
  {
    id: 27,
    file: "dreamstate-fm.webp",
    aspect: 3 / 2,
    label: "Dreamstate FM",
  },
  {
    id: 28,
    file: "sora-motors.webp",
    aspect: 3 / 2,
    label: "Sora Motors",
  },
  { id: 29, file: "nova.webp", aspect: 1 / 4, label: "Nova vertical" },
  {
    id: 30,
    file: "legacy-pixel-koi.webp",
    aspect: 2 / 3,
    label: "Pixel koi (legacy favorite)",
  },
] as const;

// ── Key helpers ────────────────────────────────────────────────────────────
// Centralizing the naming convention here means manifests, factories, and the
// wall-ad renderer all agree on how a numeric id maps to a string key.

const pad = (n: number): string => n.toString().padStart(2, "0");

/** Stable texture key derived from the catalog id. */
export const adTextureKey = (id: number): string => `ad_${pad(id)}`;

/** Material key for a specific style of a specific ad. */
export const adMatKey = (id: number, style: AdStyle): string =>
  `ad_${style}_${pad(id)}`;

/** Find metadata for an ad id, returns undefined if unknown. */
export function findAdMeta(id: number): AdMeta | undefined {
  return ADS_META.find((m) => m.id === id);
}
