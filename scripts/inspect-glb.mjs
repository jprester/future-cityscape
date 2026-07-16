#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

function parseJsonChunk(file) {
  if (file.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("Input is not a binary glTF (GLB) file");
  }

  let offset = 12;
  while (offset < file.length) {
    const length = file.readUInt32LE(offset);
    const type = file.readUInt32LE(offset + 4);
    if (type === JSON_CHUNK) {
      return JSON.parse(file.subarray(offset + 8, offset + 8 + length));
    }
    offset += 8 + length;
  }
  throw new Error("GLB has no JSON chunk");
}

function unionBounds(bounds, accessor) {
  if (!accessor?.min || !accessor?.max) return bounds;
  if (!bounds) return { min: [...accessor.min], max: [...accessor.max] };
  for (let axis = 0; axis < 3; axis += 1) {
    bounds.min[axis] = Math.min(bounds.min[axis], accessor.min[axis]);
    bounds.max[axis] = Math.max(bounds.max[axis], accessor.max[axis]);
  }
  return bounds;
}

function inspect(filename) {
  const json = parseJsonChunk(readFileSync(filename));
  let bounds = null;
  let vertices = 0;
  let triangles = 0;
  let primitives = 0;
  let primitivesWithUvs = 0;

  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      primitives += 1;
      const position = json.accessors?.[primitive.attributes?.POSITION];
      if (position) {
        vertices += position.count || 0;
        bounds = unionBounds(bounds, position);
      }
      if (primitive.attributes?.TEXCOORD_0 !== undefined) {
        primitivesWithUvs += 1;
      }
      const indices = json.accessors?.[primitive.indices];
      if ((primitive.mode ?? 4) === 4 && indices) {
        triangles += Math.floor((indices.count || 0) / 3);
      }
    }
  }

  return {
    file: path.resolve(filename),
    asset: json.asset,
    scenes: json.scenes?.length || 0,
    nodes: json.nodes?.length || 0,
    meshes: json.meshes?.length || 0,
    primitives,
    primitivesWithUvs,
    vertices,
    triangles,
    bounds,
    dimensions: bounds
      ? bounds.max.map((value, axis) => Number((value - bounds.min[axis]).toFixed(4)))
      : null,
    materials: (json.materials || []).map((material) => material.name),
    materialChannels: (json.materials || []).map((material) => ({
      name: material.name,
      baseColorTexture:
        material.pbrMetallicRoughness?.baseColorTexture?.index !== undefined,
      metallicRoughnessTexture:
        material.pbrMetallicRoughness?.metallicRoughnessTexture?.index !== undefined,
      normalTexture: material.normalTexture?.index !== undefined,
      emissiveTexture: material.emissiveTexture?.index !== undefined,
      emissiveFactor: material.emissiveFactor,
      extensions: Object.keys(material.extensions || {}),
    })),
    textures: json.textures?.length || 0,
    images: (json.images || []).map((image) => ({
      name: image.name,
      mimeType: image.mimeType,
      embedded: image.bufferView !== undefined,
    })),
  };
}

const filename = process.argv[2];
if (!filename) {
  console.error("Usage: node scripts/inspect-glb.mjs input.glb");
  process.exit(1);
}

try {
  console.log(JSON.stringify(inspect(filename), null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
