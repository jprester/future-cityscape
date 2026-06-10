import { useEffect, useMemo, useRef, useState } from "react";
import {
  Group,
  Mesh,
  CylinderGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  TextureLoader,
  BackSide,
  SRGBColorSpace,
  MirroredRepeatWrapping,
  ClampToEdgeWrapping,
} from "three";
import type { Texture } from "three";

// A panoramic "very distant city" wrapped on a horizon cylinder behind all the
// real buildings. It loads a real skyline image (`IMAGE_URL`); if that's missing
// it falls back to a procedurally-drawn canvas skyline. The material has fog off
// and depthWrite off, so it sits quietly behind the real, fogged city as a faint
// backdrop. A top alpha-fade melts the band into the real night sky, and the
// image is mirror-repeated around the ring to cut horizontal stretch (and avoid
// a visible wrap seam — mirrored edges always match).

// ── World placement (tune these to sit the band on the horizon) ──────────────
const RADIUS = 2700; // < camera far (2800); just beyond the farthest real city
const HEIGHT = 1500; // vertical extent of the cylinder
const Y_OFFSET = 420; // raise/lower so the skyline sits around the eye horizon
const REPEAT_X = 3; // mirror-repeat count around the ring (less stretch, no seam)

const IMAGE_URL = "/assets/textures/environment/horizon-skyline.png";

// ── Light-pollution glow ──────────────────────────────────────────────────────
// Haze over a megacity is never darkest at the horizon — millions of lights
// scatter up into it. The glow is baked ADDITIVELY into the panorama texture
// itself rather than rendered as a separate layer behind the band: the band's
// top alpha-fade makes its distant towers semi-transparent, so any bright layer
// behind them bleeds through and they read as see-through. Composited into the
// same texture, the glow brightens those pixels like haze in front of them
// instead.
function bakeHorizonGlow(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, width, height);

  // Additive vertical gradient: a long, gentle decay from the very top of the
  // band down to a modest warm peak around the rooftop line, fading out again
  // below it (the lower band is behind the real city anyway). The slow build
  // from zero matters: a fast ramp reads as a hard band edge against the dark
  // sky.
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0.0, "rgba(0,0,0,0)");
  g.addColorStop(0.3, "rgba(35,28,65,0.12)");
  g.addColorStop(0.52, "rgba(85,62,115,0.24)");
  g.addColorStop(0.7, "rgba(185,125,110,0.28)");
  g.addColorStop(0.92, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

const FOG_TINT = [27, 24, 56]; // procedural-fallback tint; matches 0x1b1838

type Layer = {
  groundV: number; // 0..1 down the canvas where this row's bases sit
  minH: number;
  maxH: number;
  body: string; // base silhouette colour
  topRim: string; // slightly lighter top edge (atmospheric rim light)
  litChance: number; // fraction of window cells that glow
  alpha: number; // overall layer opacity (far rows dimmer)
};

function drawLayer(ctx: CanvasRenderingContext2D, W: number, H: number, l: Layer) {
  const groundY = H * l.groundV;
  ctx.globalAlpha = l.alpha;
  let x = 0;
  while (x < W) {
    const bw = 16 + Math.random() * 48;
    const bh = l.minH + Math.random() * Math.random() * (l.maxH - l.minH);
    const top = groundY - bh;

    // Body with a faint vertical rim (lighter at the top edge → hazy depth).
    const grad = ctx.createLinearGradient(0, top, 0, groundY);
    grad.addColorStop(0, l.topRim);
    grad.addColorStop(0.25, l.body);
    grad.addColorStop(1, l.body);
    ctx.fillStyle = grad;
    ctx.fillRect(x, top, bw, bh);

    // Window dots — a sparse grid of warm/cool lights.
    const cols = Math.max(1, Math.floor(bw / 7));
    const rows = Math.max(1, Math.floor(bh / 9));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() > l.litChance) continue;
        const warm = Math.random() < 0.38;
        ctx.fillStyle = warm
          ? "rgba(255,185,95,0.9)"
          : "rgba(150,185,255,0.85)";
        const wx = x + 2 + c * 7 + Math.random() * 2;
        const wy = top + 3 + r * 9 + Math.random() * 2;
        ctx.fillRect(wx, wy, 2, 2);
      }
    }
    x += bw + Math.random() * 6;
  }
  ctx.globalAlpha = 1;
}

function buildSkylineTexture(): CanvasTexture {
  const W = 4096;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const [fr, fg, fb] = FOG_TINT;

  // Atmospheric glow just above the rooftops, fading up into the transparent
  // sky so the band melts into the real sky background.
  const glow = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.62);
  glow.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
  glow.addColorStop(1, `rgba(${fr + 18},${fg + 14},${fb + 24},0.55)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H * 0.62);

  // Far row (dim, higher up) then a darker, taller near row → layered depth.
  drawLayer(ctx, W, H, {
    groundV: 0.5,
    minH: 18,
    maxH: 120,
    body: "#171428",
    topRim: "#2a2545",
    litChance: 0.1,
    alpha: 0.6,
  });
  drawLayer(ctx, W, H, {
    groundV: 0.6,
    minH: 40,
    maxH: 300,
    body: "#0e0b18",
    topRim: "#221d3a",
    litChance: 0.16,
    alpha: 1,
  });

  // Fog tint overlay, strongest toward the base → low contrast, distant feel.
  const tint = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.62);
  tint.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
  tint.addColorStop(1, `rgba(${fr},${fg},${fb},0.4)`);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H * 0.62);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Vertical alpha ramp (grayscale; alphaMap samples luminance). flipY is on by
// default, so canvas-top maps to the cylinder top → transparent up top (the
// image's own sky), fading to opaque over the skyline so it melts into the real
// night sky.
function makeFadeAlphaMap(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  // Long eased ramp (slow build from transparent, steeper near opaque): a short
  // linear fade reads as an abrupt border where the band meets the dark sky.
  g.addColorStop(0.0, "#000"); // top (sky) → transparent
  g.addColorStop(0.05, "#000");
  g.addColorStop(0.3, "#222");
  g.addColorStop(0.45, "#666");
  g.addColorStop(0.58, "#fff"); // fully opaque over the rooftops
  g.addColorStop(1.0, "#fff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

export function HorizonSkyline({ visible }: { visible: boolean }) {
  const groupRef = useRef<Group>(null);
  const [imageTex, setImageTex] = useState<Texture | null>(null);

  const hasDom = typeof document !== "undefined";

  // Load the real panorama; on failure we silently keep the procedural canvas.
  useEffect(() => {
    let cancelled = false;
    new TextureLoader().load(
      IMAGE_URL,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        setImageTex(tex);
      },
      undefined,
      () => {
        /* missing image → procedural fallback stays */
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const fallback = useMemo(
    () => (hasDom ? buildSkylineTexture() : null),
    [hasDom],
  );
  const alphaMap = useMemo(
    () => (hasDom ? makeFadeAlphaMap() : null),
    [hasDom],
  );

  const mesh = useMemo(() => {
    const source = imageTex ?? fallback;
    if (!source) return null;

    // Bake the light-pollution glow into the panorama pixels (see
    // bakeHorizonGlow for why it can't be a separate layer).
    const sourceImage = source.image as HTMLImageElement | HTMLCanvasElement;
    const map = new CanvasTexture(
      bakeHorizonGlow(sourceImage, sourceImage.width, sourceImage.height),
    );

    map.colorSpace = SRGBColorSpace;
    map.wrapS = MirroredRepeatWrapping; // mirror around the ring → no seam
    map.wrapT = ClampToEdgeWrapping;
    map.repeat.set(REPEAT_X, 1);
    map.needsUpdate = true;

    const geometry = new CylinderGeometry(RADIUS, RADIUS, HEIGHT, 128, 1, true);
    const material = new MeshBasicMaterial({
      map,
      alphaMap: alphaMap ?? undefined,
      side: BackSide, // viewed from inside the cylinder
      transparent: true,
      depthWrite: false, // never occlude the real (closer) buildings
      fog: false, // distance haze is in the image itself
      toneMapped: false,
    });
    const m = new Mesh(geometry, material);
    m.position.y = Y_OFFSET;
    m.renderOrder = -1; // draw before the city
    return m;
  }, [imageTex, fallback, alphaMap]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || !mesh) return;
    group.add(mesh);
    return () => {
      group.remove(mesh);
      mesh.geometry.dispose();
      const material = mesh.material as MeshBasicMaterial;
      material.map?.dispose(); // the baked CanvasTexture, owned by the mesh
      material.dispose();
    };
  }, [mesh]);

  // Dispose textures when they change / on unmount.
  useEffect(
    () => () => {
      imageTex?.dispose();
      fallback?.dispose();
      alphaMap?.dispose();
    },
    [imageTex, fallback, alphaMap],
  );

  if (!visible) return null;
  return <group ref={groupRef} />;
}
