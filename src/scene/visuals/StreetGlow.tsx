import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
} from "three";
import { CITY_BLOCK_SIZE, ROAD_WIDTH } from "../../config/world";
import type { FiniteCityLayout } from "../../config/cityLayouts";

// Street-level light: small additive point sprites along the road centerlines
// around every real block (street lamps / storefront spill). From the rooftop
// they read as faint glowing dots lining the canyons — the fog diffuses the
// distant ones into a believable street glow. Two Points batches (warm sodium
// majority, cool signage minority) = 2 draw calls; buildings occlude them, so
// they only show down open streets.

const LAMP_STEP = 32; // spacing along a block edge (5 lamps per 128 u edge)
const LAMP_HEIGHT = 5;
const COOL_RATIO = 0.25;

// Without a map, PointsMaterial draws hard untextured SQUARES — from the roof
// they read as colored confetti on the streets. A tiny radial-gradient sprite
// turns each point into a soft glow disc.
function makeGlowSprite(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

export function StreetGlow({
  layout,
  visible,
}: {
  layout: FiniteCityLayout;
  visible: boolean;
}) {
  const { warmGeo, coolGeo } = useMemo(() => {
    const warm: number[] = [];
    const cool: number[] = [];
    const seen = new Set<string>();
    const half = CITY_BLOCK_SIZE / 2;
    const off = half + ROAD_WIDTH / 2; // block center → road centerline

    const add = (x: number, z: number) => {
      const key = `${x}|${z}`;
      if (seen.has(key)) return;
      seen.add(key);
      // Deterministic warm/cool pick from the coordinates.
      const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
      (h < COOL_RATIO ? cool : warm).push(x, LAMP_HEIGHT, z);
    };

    for (const t of layout.groundTiles) {
      for (let s = -half; s <= half; s += LAMP_STEP) {
        add(t.x + s, t.z - off); // north edge road
        add(t.x + s, t.z + off); // south
        add(t.x - off, t.z + s); // west
        add(t.x + off, t.z + s); // east
      }
    }

    const build = (arr: number[]) => {
      const geo = new BufferGeometry();
      geo.setAttribute("position", new Float32BufferAttribute(arr, 3));
      return geo;
    };
    return { warmGeo: build(warm), coolGeo: build(cool) };
  }, [layout]);

  const sprite = useMemo(() => makeGlowSprite(), []);

  useEffect(() => {
    return () => {
      warmGeo.dispose();
      coolGeo.dispose();
      sprite.dispose();
    };
  }, [warmGeo, coolGeo, sprite]);

  if (!visible) return null;
  return (
    <>
      <points geometry={warmGeo}>
        <pointsMaterial
          map={sprite}
          color="#ffb35c"
          size={6}
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <points geometry={coolGeo}>
        <pointsMaterial
          map={sprite}
          color="#6fd8ff"
          size={5.5}
          transparent
          opacity={0.45}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
}
