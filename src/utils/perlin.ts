export type PerlinNoiseInstance = {
  noise: (x: number, y: number, z?: number) => number;
  noiseDetail: (lod: number, falloff: number) => void;
};

type PerlinCtor = new (seed?: number) => PerlinNoiseInstance;

declare global {
  interface Window {
    Perlin?: PerlinCtor;
  }

  // Global script from public/js/proc-noise.js
  // eslint-disable-next-line no-var
  var Perlin: PerlinCtor | undefined;
}

function resolvePerlinCtor(): PerlinCtor {
  const globalCtor = typeof globalThis.Perlin !== "undefined"
    ? globalThis.Perlin
    : window.Perlin;

  if (!globalCtor) {
    throw new Error("Perlin global is missing. Ensure public/js/proc-noise.js is loaded.");
  }

  return globalCtor;
}

export function createPerlin(seed?: number): PerlinNoiseInstance {
  const Ctor = resolvePerlinCtor();
  return new Ctor(seed);
}

