/**
 * Shrinks the runtime GLB payload: prune unused data, weld duplicate vertices,
 * downscale + WebP the embedded textures, Draco-compress the geometry.
 *
 *   node scripts/optimize-assets.mjs                    # dry run → .asset-cache/optimized
 *   node scripts/optimize-assets.mjs --apply            # overwrite public/assets in place
 *   node scripts/optimize-assets.mjs --max-texture 1024 # tighter texture cap
 *   node scripts/optimize-assets.mjs --no-draco         # textures only
 *   node scripts/optimize-assets.mjs public/assets/models/buildings/towers/lz-tower-4.glb
 *
 * WHY DRACO AND NOT MESHOPT
 * -------------------------
 * meshopt implies KHR_mesh_quantization: positions arrive as *normalized
 * integer* attributes with a compensating scale on the node. AssetManager bakes
 * node transforms into the geometry (AssetManager.ts:483 and :525) via
 * `applyMatrix4`, and three's `BufferAttribute.setXYZ` re-normalizes writes back
 * into the integer range — so world-scale coordinates would clamp and every
 * model would collapse. DRACOLoader decodes to float32, so the same bake is
 * safe. Do not swap this for meshopt without first dequantizing at load time.
 *
 * WHY prune({ keepAttributes: true })
 * ----------------------------------
 * Dropping "unused" attributes is decided per-primitive. Two primitives in one
 * GLB can end up with different attribute sets, and AssetManager merges all
 * primitives of a model with BufferGeometryUtils.mergeGeometries, which returns
 * null on a mismatch — the model would silently vanish. Keeping attributes
 * costs a little size and removes that whole failure mode.
 */

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  draco,
  prune,
  textureCompress,
  weld,
  inspect,
} from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import { buildCorpus, listAssets, classify, formatBytes } from "./lib/assetRefs.mjs";

const ASSET_DIR = "public/assets";
const OUT_DIR = ".asset-cache/optimized";

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const apply = flag("--apply");
const force = flag("--force");
const useDraco = !flag("--no-draco");
const maxTexture = Number(value("--max-texture", 2048));
const quality = Number(value("--quality", 82));
// Normal and metallicRoughness maps carry geometry-ish data, not color; lossy
// WebP at colour quality produces visible banding in the shading, so they get
// their own higher setting.
const dataQuality = Number(value("--data-quality", 94));
const explicitFiles = args.filter((a) => !a.startsWith("--") && a.endsWith(".glb"));

// ── Target selection ────────────────────────────────────────────────────────
function selectTargets() {
  if (explicitFiles.length) return explicitFiles;
  const corpus = buildCorpus();
  return listAssets(ASSET_DIR)
    .filter((f) => f.rel.endsWith(".glb"))
    .filter((f) => classify(f.rel, corpus) !== "none")
    .map((f) => f.abs)
    .sort();
}

// ── Safety: --apply overwrites tracked files ────────────────────────────────
if (apply && !force) {
  const { execSync } = await import("node:child_process");
  const dirty = execSync(`git status --porcelain ${ASSET_DIR}`, {
    encoding: "utf8",
  }).trim();
  if (dirty) {
    console.error(
      `\nRefusing to --apply: ${ASSET_DIR} has uncommitted changes.\n` +
        `Commit or stash them first so the originals stay recoverable, or pass --force.\n`,
    );
    process.exit(1);
  }
}

// ── Pipeline ────────────────────────────────────────────────────────────────
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.encoder": await draco3d.createEncoderModule(),
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });

function transformsFor() {
  const list = [
    dedup(),
    prune({ keepAttributes: true, keepLeaves: false }),
    weld(),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [maxTexture, maxTexture],
      quality,
      effort: 90,
      slots: /^(?!normalTexture|metallicRoughnessTexture).*$/,
    }),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [maxTexture, maxTexture],
      quality: dataQuality,
      effort: 90,
      slots: /^(normalTexture|metallicRoughnessTexture)$/,
    }),
  ];
  if (useDraco) list.push(draco({ method: "edgebreaker" }));
  return list;
}

function stats(document) {
  const report = inspect(document);
  return {
    vertices: report.meshes.properties.reduce((a, m) => a + (m.vertices || 0), 0),
    textures: report.textures.properties.length,
    texturePixels: report.textures.properties.reduce((a, t) => {
      const [w, h] = (t.resolution || "0x0").split("x").map(Number);
      return a + (w || 0) * (h || 0);
    }, 0),
  };
}

const targets = selectTargets();
if (!targets.length) {
  console.error("No GLB targets found.");
  process.exit(1);
}

console.log(
  `\nOptimizing ${targets.length} GLB${targets.length === 1 ? "" : "s"} ` +
    `— textures ≤${maxTexture}px webp q${quality}` +
    `${useDraco ? ", draco geometry" : ""}\n` +
    `Output: ${apply ? "IN PLACE (" + ASSET_DIR + ")" : OUT_DIR}\n`,
);

const rows = [];
let beforeTotal = 0;
let afterTotal = 0;
let failures = 0;

for (const [index, file] of targets.entries()) {
  const rel = path.relative(ASSET_DIR, file).split(path.sep).join("/");
  const before = fs.statSync(file).size;
  process.stdout.write(
    `[${String(index + 1).padStart(2)}/${targets.length}] ${rel} … `,
  );

  try {
    const document = await io.read(file);
    const beforeStats = stats(document);
    await document.transform(...transformsFor());
    const afterStats = stats(document);
    const bytes = await io.writeBinary(document);

    // Draco's per-primitive header and WebP's floor cost can exceed the saving
    // on low-poly meshes with already-small textures. Keeping the original is
    // strictly better there, and avoids paying decode time for nothing.
    const worthIt = bytes.byteLength < before * 0.95;
    const after = worthIt ? bytes.byteLength : before;

    const dest = apply ? file : path.join(OUT_DIR, rel);
    if (worthIt) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bytes);
    } else if (!apply) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
    }

    beforeTotal += before;
    afterTotal += after;
    rows.push({ rel, before, after, beforeStats, afterStats, skipped: !worthIt });
    console.log(
      worthIt
        ? `${formatBytes(before)} → ${formatBytes(after)}  (${(before / after).toFixed(1)}×)`
        : `${formatBytes(before)} — kept original (no worthwhile saving)`,
    );
  } catch (error) {
    failures++;
    beforeTotal += before;
    afterTotal += before;
    console.log(`FAILED — ${error.message}`);
    // An unoptimized copy keeps the staging tree complete and loadable.
    if (!apply) {
      const dest = path.join(OUT_DIR, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
    }
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log("\nBiggest savings:");
for (const row of [...rows].sort((a, b) => b.before - b.after - (a.before - a.after)).slice(0, 10)) {
  console.log(
    `  ${formatBytes(row.before - row.after).padStart(9)} saved  ` +
      `${formatBytes(row.before).padStart(9)} → ${formatBytes(row.after).padStart(9)}  ${row.rel}`,
  );
}

console.log(
  `\nTotal: ${formatBytes(beforeTotal)} → ${formatBytes(afterTotal)} ` +
    `(${(beforeTotal / afterTotal).toFixed(1)}× smaller, ${formatBytes(beforeTotal - afterTotal)} saved)`,
);
if (failures) console.log(`${failures} file(s) failed and were left unchanged.`);

if (!apply) {
  console.log(
    `\nDry run — originals untouched. Compare in ${OUT_DIR}, then re-run with --apply.\n` +
      `Draco output needs DRACOLoader wired up in AssetManager (see scripts/README-assets.md).\n`,
  );
} else {
  console.log(`\nApplied in place. Verify the city renders, then commit.\n`);
}
