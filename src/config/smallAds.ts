// ============================================================================
// Small ads / neon signs — single source of truth
// ============================================================================
//
// Each runtime WebP under public/assets/textures/small-ads/<bucket>/ becomes one
// entry below. Lossless source PNGs live outside public/ under
// art-source/textures/small-ads so Vite does not copy or serve the 81 MB source
// catalog. Bucket folder names encode the aspect ratio (w-h), e.g. "1-4" =
// tall vertical, "4-1" = wide horizontal.
//
// The textures, materials, and procedural placement pools are all derived
// from SMALL_ADS_META, so adding a new sign means:
//   1. Keep the source PNG in art-source/textures/small-ads/<bucket>/ and export
//      a max-1024px WebP into public/assets/textures/small-ads/<bucket>/
//   2. Append a SmallAdMeta row with the matching filename + bucket
//   3. Done — texture + material auto-register, procedural picker picks it up

export type SmallAdBucket = "1-4" | "2-3" | "3-2" | "4-1";

export type SmallAdMeta = {
  /** Stable string id; unique across all buckets. Used as the key suffix
   *  for both texture and material registrations. */
  id: string;
  /** Aspect ratio width/height. Derived from bucket name. */
  aspect: number;
  /** Source folder bucket. */
  bucket: SmallAdBucket;
  /** Runtime WebP filename inside textures/small-ads/<bucket>/. */
  file: string;
};

const BUCKET_ASPECT: Record<SmallAdBucket, number> = {
  "1-4": 1 / 4,
  "2-3": 2 / 3,
  "3-2": 3 / 2,
  "4-1": 4 / 1,
};

function entry(bucket: SmallAdBucket, idx: number, file: string): SmallAdMeta {
  return {
    id: `${bucket}_${idx.toString().padStart(2, "0")}`,
    aspect: BUCKET_ASPECT[bucket],
    bucket,
    file,
  };
}

// ── Catalog ────────────────────────────────────────────────────────────────

export const SMALL_ADS_META: readonly SmallAdMeta[] = [
  // Tall vertical neon signs (1:4)
  entry("1-4", 1, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__35d57c3f-0fd0-4a81-9c54-20ebdf9f78fe_0.webp"),
  entry("1-4", 2, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__35d57c3f-0fd0-4a81-9c54-20ebdf9f78fe_1.webp"),
  entry("1-4", 3, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__35d57c3f-0fd0-4a81-9c54-20ebdf9f78fe_2.webp"),
  entry("1-4", 4, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__35d57c3f-0fd0-4a81-9c54-20ebdf9f78fe_3.webp"),
  entry("1-4", 5, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__74e34edc-a2a9-4394-9a68-d6ebee37ca91_0.webp"),
  entry("1-4", 6, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__74e34edc-a2a9-4394-9a68-d6ebee37ca91_2.webp"),
  entry("1-4", 7, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__74e34edc-a2a9-4394-9a68-d6ebee37ca91_3.webp"),
  entry("1-4", 8, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__efaafd25-684c-431f-bb2b-8100d1c3c94a_0.webp"),
  entry("1-4", 9, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__efaafd25-684c-431f-bb2b-8100d1c3c94a_1.webp"),
  entry("1-4", 10, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__efaafd25-684c-431f-bb2b-8100d1c3c94a_2.webp"),
  entry("1-4", 11, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__efaafd25-684c-431f-bb2b-8100d1c3c94a_3.webp"),
  entry("1-4", 12, "thenightocean_vertical_neon_sign_in_Japanese_cyberpunk_style__f2e7764e-b018-4bc2-a3a5-a07da0aac1ff_2.webp"),
  entry("1-4", 13, "thenightocean_vertical_neon_sign_in_japanese_glowing_cyan_mag_315fc52f-bacc-4c9b-9312-d0d6ba5813f4_0.webp"),
  entry("1-4", 14, "thenightocean_vertical_neon_sign_in_japanese_glowing_cyan_mag_9c7e90a8-0cc1-48d7-be76-960fcd6aaaaf_2.webp"),

  // Portrait posters (2:3)
  entry("2-3", 1, "thenightocean_beautiful_cyberpunk_samurai_girl_pink_neon_kata_cdf17ad6-63db-4bc1-bf15-a1dbe6b26c20_2.webp"),
  entry("2-3", 2, "thenightocean_beautiful_cyberpunk_samurai_girl_pink_neon_kata_cdf17ad6-63db-4bc1-bf15-a1dbe6b26c20_3.webp"),
  entry("2-3", 3, "thenightocean_cyberpunk_advertisment_holographic_lettering_sy_2be55c6a-f82b-459d-bb56-0ec858b5d1d7_1.webp"),
  entry("2-3", 4, "coinone_contents_close_up_futuristic_Japanese_anime_poster_back_312d03a0-5376-40c7-be21-2c4760fb9f3c.webp"),
  entry("2-3", 5, "disagiovanile_Sony_A7R_IV_DSLR_digital_camera_24mm_lens_f16_Fas_4ac87bab-404c-4b7d-8b60-34b293a6aa99.webp"),
  entry("2-3", 6, "g0crazyg0stupid_A_2000s_Japanese_Y2K_street_magazine_style_post_af2fc279-3fb1-46b6-8f0c-2572df9d8444.webp"),
  entry("2-3", 7, "thenightocean_cyberpunk_advertisment_holographic_lettering_de_afa560f4-a505-4503-869c-e326e47b4779_2.webp"),
  entry("2-3", 8, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_14bef8de-a2b0-4ae2-808b-a8b3ed5b9023_0.webp"),
  entry("2-3", 9, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_1ab4c8fe-0865-408e-8f93-ba16828c41e9_2.webp"),
  entry("2-3", 10, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_27ad2a37-f86a-42cd-b068-38a4ca9e55ae_1.webp"),
  entry("2-3", 11, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_31d93d3e-f265-43e9-b27e-726b18bc8078_0.webp"),
  entry("2-3", 12, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_73aed7cf-a8de-4f7e-af17-ff2cde779e95_2.webp"),
  entry("2-3", 13, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_b93e72a2-b196-49fe-bacc-3a13e89c4971_0.webp"),

  // Landscape posters (3:2)
  entry("3-2", 1, "thenightocean_cyberpunk_japanese_advertisment_holographic_let_e1694664-bd93-40ca-8c71-77be5b3af8de_0.webp"),
  entry("3-2", 2, "thenightocean_cyberpunk_japanese_advertisment_holographic_let_e1694664-bd93-40ca-8c71-77be5b3af8de_1.webp"),
  entry("3-2", 3, "thenightocean_cyberpunk_japanese_advertisment_holographic_let_e1694664-bd93-40ca-8c71-77be5b3af8de_2.webp"),
  entry("3-2", 4, "thenightocean_cyberpunk_japanese_advertisment_holographic_let_e1694664-bd93-40ca-8c71-77be5b3af8de_3.webp"),
  entry("3-2", 5, "thenightocean_cyberpunk_japanese_advertisment_holographic_let_f18999e3-ec0e-4a25-96c2-6e5cb92cb9e4_1.webp"),
  entry("3-2", 6, "thenightocean_cyberpunk_poster_Japanese_woman_--ar_32_--v_7_a2addc3b-40e5-41d1-83a2-eac68f0982be_0.webp"),
  entry("3-2", 7, "thenightocean_cyberpunk_poster_Japanese_woman_--ar_32_--v_7_a2addc3b-40e5-41d1-83a2-eac68f0982be_1.webp"),
  entry("3-2", 8, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_de8d1ad1-e914-4e37-879b-5fb115d14f50_1.webp"),
  entry("3-2", 9, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_de8d1ad1-e914-4e37-879b-5fb115d14f50_2.webp"),
  entry("3-2", 10, "thenightocean_cyberpunk_poster_Japanese_woman_holographic_let_de8d1ad1-e914-4e37-879b-5fb115d14f50_3.webp"),
  entry("3-2", 11, "joan12404_A_poster_for_an_advertising_campaign_featuring_two_Ja_3f8b65b0-2278-4780-aef5-e996409ac565.webp"),

  // Wide horizontal neon signs (4:1)
  entry("4-1", 1, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_cb2aec4c-9264-4ac1-87e2-0d589515038c_0.webp"),
  entry("4-1", 2, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_cb2aec4c-9264-4ac1-87e2-0d589515038c_1.webp"),
  entry("4-1", 3, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_cb2aec4c-9264-4ac1-87e2-0d589515038c_2.webp"),
  entry("4-1", 4, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_cb2aec4c-9264-4ac1-87e2-0d589515038c_3.webp"),
  entry("4-1", 5, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_d85e2b44-78a8-4b36-ae0a-e1ad29ea1a9d_2.webp"),
  entry("4-1", 6, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_d85e2b44-78a8-4b36-ae0a-e1ad29ea1a9d_3.webp"),
  entry("4-1", 7, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_f3557fd1-d5b4-4417-88e1-e19c45d2e92d_0.webp"),
  entry("4-1", 8, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_f3557fd1-d5b4-4417-88e1-e19c45d2e92d_1.webp"),
  entry("4-1", 9, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_f3557fd1-d5b4-4417-88e1-e19c45d2e92d_2.webp"),
  entry("4-1", 10, "thenightocean_horizontal_neon_sign_in_Japanese_cyberpunk_styl_f3557fd1-d5b4-4417-88e1-e19c45d2e92d_3.webp"),
] as const;

// ── Bucket pools (derived) ──────────────────────────────────────────────────

export const SMALL_ADS_BY_BUCKET: Record<SmallAdBucket, readonly SmallAdMeta[]> = {
  "1-4": SMALL_ADS_META.filter((a) => a.bucket === "1-4"),
  "2-3": SMALL_ADS_META.filter((a) => a.bucket === "2-3"),
  "3-2": SMALL_ADS_META.filter((a) => a.bucket === "3-2"),
  "4-1": SMALL_ADS_META.filter((a) => a.bucket === "4-1"),
};

// ── Key helpers ────────────────────────────────────────────────────────────

/** Texture key — matches the PNG filename slot in textures/small-ads/<bucket>/. */
export const smallAdTextureKey = (id: string): string => `sa_${id}`;

/** Material key — one billboard-style material per id, double-sided. */
export const smallAdMatKey = (id: string): string => `sa_mat_${id}`;
