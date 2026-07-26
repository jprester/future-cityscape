/**
 * Shared asset-reference resolution.
 *
 * Answers "is this file in public/assets/ actually reachable from the app?"
 * Asset paths reach the runtime three ways, so we check all three:
 *
 *   1. Literal   — `path: "models/buildings/towers/lz-tower-4.glb"`
 *   2. Template  — `path: \`models/car_${id}.obj\``  (manifests build keys in loops)
 *   3. Filename  — `{ id: 18, file: "kitsune.webp" }` in a config array, joined
 *                  with a directory by a template elsewhere
 *
 * Every check errs toward "referenced". A false positive only means we keep a
 * file we could have deleted; a false negative would delete a live asset.
 */

import fs from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|json|html)$/;

/** Confidence tiers, strongest first. `none` = no evidence anywhere. */
export const REF_TIERS = ["path", "template", "filename", "stem", "none"];

function walk(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, onFile);
    else if (entry.isFile()) onFile(abs);
  }
}

/** Every source file's text, concatenated, plus the template patterns in it. */
export function buildCorpus(roots = ["src", "index.html"]) {
  let text = "";
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stat = fs.statSync(root);
    if (stat.isFile()) {
      text += fs.readFileSync(root, "utf8") + "\n";
      continue;
    }
    walk(root, (abs) => {
      if (SOURCE_EXTENSIONS.test(abs)) text += fs.readFileSync(abs, "utf8") + "\n";
    });
  }

  // Backtick strings that look like asset paths → anchored regexes.
  // `models/car_${id}.obj` becomes /(^|\/)models\/car_[^/]*\.obj$/
  const templates = [];
  for (const match of text.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
    const raw = match[1];
    if (!/\$\{/.test(raw)) continue;
    if (!/(models|textures|assets|layouts)\//.test(raw)) continue;
    const escaped = raw
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      // Undo the escape on the interpolation marker, then widen it.
      .replace(/\\\$\\\{[^}]*\\\}/g, "[^/]*");
    try {
      templates.push(new RegExp(`(^|/)${escaped}$`));
    } catch {
      // A template too gnarly to convert is simply not used as evidence.
    }
  }

  return { text, templates };
}

/** List every file under `dir` as { abs, rel, size }, rel to `dir`. */
export function listAssets(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  walk(dir, (abs) => {
    out.push({
      abs,
      rel: path.relative(dir, abs).split(path.sep).join("/"),
      size: fs.statSync(abs).size,
    });
  });
  return out;
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * How strongly is `rel` (a path relative to public/assets) referenced?
 * Returns one of REF_TIERS.
 */
export function classify(rel, corpus) {
  const { text, templates } = corpus;
  const base = path.basename(rel);
  const stem = base.replace(/\.[^.]+$/, "");

  // 1. The full relative path, raw or percent-encoded (models.ts URI-encodes
  //    the vent filenames because they contain spaces).
  for (const candidate of [rel, encodeURI(rel), decode(rel)]) {
    if (text.includes(candidate)) return "path";
  }

  // 2. A loop-built template path.
  for (const pattern of templates) {
    if (pattern.test(rel)) return "template";
  }

  // 3. Bare filename — how config arrays (ADS_META, SMALL_ADS_META) name files.
  for (const candidate of [base, decode(base)]) {
    if (text.includes(candidate)) return "filename";
  }

  // 4. Stem only. Deliberately a substring test: "hero-skyscraper" matching
  //    inside "hero-skyscraper-v2.glb" is a false positive we accept, because
  //    the alternative is deleting a file that some other spelling reaches.
  for (const candidate of [stem, decode(stem)]) {
    if (candidate.length >= 4 && text.includes(candidate)) return "stem";
  }

  return "none";
}

export function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + " GB";
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}
