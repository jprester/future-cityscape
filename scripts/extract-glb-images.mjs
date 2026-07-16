#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function usage() {
  console.error("Usage: node scripts/extract-glb-images.mjs input.glb output-dir");
  process.exit(1);
}

function safeName(name, fallback) {
  return (name || fallback)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "") || fallback;
}

function extensionForMimeType(mimeType) {
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/ktx2": ".ktx2",
  }[mimeType] || ".bin";
}

function parseGlb(file) {
  if (file.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("Input is not a binary glTF (GLB) file");
  }

  const version = file.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}`);
  }

  let json;
  let binary;
  let offset = 12;
  while (offset < file.length) {
    const length = file.readUInt32LE(offset);
    const type = file.readUInt32LE(offset + 4);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString("utf8"));
    if (type === BIN_CHUNK) binary = data;
    offset += 8 + length;
  }

  if (!json || !binary) {
    throw new Error("GLB must contain JSON and BIN chunks");
  }
  return { json, binary };
}

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  if (!inputArg || !outputArg) usage();

  const input = path.resolve(inputArg);
  const outputDir = path.resolve(outputArg);
  const { json, binary } = parseGlb(await readFile(input));
  await mkdir(outputDir, { recursive: true });

  for (const [index, image] of (json.images || []).entries()) {
    const fallback = `image-${String(index + 1).padStart(2, "0")}`;
    if (image.bufferView !== undefined) {
      const view = json.bufferViews[image.bufferView];
      const start = view.byteOffset || 0;
      const data = binary.subarray(start, start + view.byteLength);
      const output = path.join(
        outputDir,
        `${safeName(image.name, fallback)}${extensionForMimeType(image.mimeType)}`,
      );
      await writeFile(output, data);
      console.log(output);
      continue;
    }

    if (image.uri && !image.uri.startsWith("data:")) {
      const source = path.resolve(path.dirname(input), decodeURIComponent(image.uri));
      const output = path.join(outputDir, safeName(image.name, path.basename(source)));
      await copyFile(source, output);
      console.log(output);
      continue;
    }

    console.warn(`Skipped unsupported image ${image.name || fallback}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
