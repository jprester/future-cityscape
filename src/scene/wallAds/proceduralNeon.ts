import {
  CanvasTexture,
  DoubleSide,
  MeshPhongMaterial,
  SRGBColorSpace,
} from "three";
import type { Material } from "three";

// ── Code-generated neon signs & logos ────────────────────────────────────────
//
// Canvas-drawn neon textures that plug into the same instanced wall-ad plane
// pipeline as the PNG catalogs — same cost, unlimited variety. Three families:
//
//   • vertical signs (1:4)   — stacked katakana, like the small-ads bucket
//   • horizontal signs (4:1)  — katakana or latin brand strips
//   • logo FAMILIES           — per generated company, THREE matching
//     textures sharing one name + palette: wide glyph+name (2:1), tracked
//     text wordmark (4:1, the SONY/TRUIST look), vertical stacked-letter
//     wordmark (1:4) — so one building can carry the same brand in several
//     placements (rooftop sign + corner wordmark, like the Ginza Sony bldg)
//
// Plus a few FLICKER variants: signs whose material emissiveIntensity is
// animated from tickNeonFlicker() (called by FiniteCityWallAds' frame loop).
// Each flicker sign has its own unique material, so animating the shared
// material still gives per-sign behavior without leaving the instanced path.
//
// The catalog is generated once per session from a FIXED seed, so signs are
// stable across reloads and world seeds. Texture generation needs the DOM, so
// materials are built lazily on first request (the meta arrays below are
// plain data and safe to import anywhere).
//
// NOTE: these materials live outside AssetManager, so the visual preset's
// emissive multipliers don't reach them — the intensity below bakes in the
// current effective small-ads value (base 1.35 × ads preset 1.4 ≈ 1.9).

export type ProceduralAdMeta = {
  /** Material key, resolved by getProceduralAdMaterial (prefix "pneon_"). */
  key: string;
  /** Width / height of the generated texture's design. */
  aspect: number;
};

const CATALOG_SEED = 0xc0ffee;
const VERTICAL_COUNT = 14;
const HORIZONTAL_COUNT = 10;
const LOGO_FAMILY_COUNT = 12;
const FLICKER_COUNT = 6;
const EMISSIVE_INTENSITY = 1.9;

const makeMetas = (prefix: string, count: number, aspect: number) =>
  Array.from({ length: count }, (_, i) => ({
    key: `pneon_${prefix}_${i.toString().padStart(2, "0")}`,
    aspect,
  }));

export const PROC_NEON_VERTICAL: ProceduralAdMeta[] = makeMetas(
  "v",
  VERTICAL_COUNT,
  1 / 4,
);
export const PROC_NEON_HORIZONTAL: ProceduralAdMeta[] = makeMetas(
  "h",
  HORIZONTAL_COUNT,
  4,
);
export const PROC_NEON_FLICKER: ProceduralAdMeta[] = makeMetas(
  "f",
  FLICKER_COUNT,
  1 / 4,
);

/** One generated company: three texture variants sharing name + colors. */
export type LogoFamily = {
  /** Glyph + name, 2:1 — crowns and mid-facade emblems. */
  wide: ProceduralAdMeta;
  /** Tracked channel-letter wordmark, 4:1 — crowns and rooftop signs. */
  text: ProceduralAdMeta;
  /** Stacked-letter wordmark, 1:4 — corner/edge placements. */
  vertical: ProceduralAdMeta;
};

export const PROC_LOGO_FAMILIES: LogoFamily[] = Array.from(
  { length: LOGO_FAMILY_COUNT },
  (_, i) => {
    const id = i.toString().padStart(2, "0");
    return {
      wide: { key: `pneon_logo_w_${id}`, aspect: 2 },
      text: { key: `pneon_logo_t_${id}`, aspect: 4 },
      vertical: { key: `pneon_logo_v_${id}`, aspect: 1 / 4 },
    };
  },
);

// ── Shared drawing vocabulary ────────────────────────────────────────────────

// Neon-dominant palette; magenta/cyan repeated so they lead the mix.
const NEON_PALETTE = [
  "#ff3df0",
  "#ff3df0",
  "#2ee6ff",
  "#2ee6ff",
  "#ffb84d",
  "#ff4747",
  "#54ff9f",
  "#b46bff",
  "#ff7ab8",
  "#4f9dff",
];

const KATAKANA =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ" +
  "マミムメモヤユヨラリルレロワンガギグゲゴザジズゼゾダデドバビブベボ";

const BRAND_SYLLABLES = [
  "zen",
  "kor",
  "dyne",
  "tek",
  "neo",
  "oni",
  "ryu",
  "aka",
  "kuro",
  "shin",
  "hex",
  "vol",
  "mira",
  "oto",
  "kai",
  "gen",
  "nex",
  "ion",
];

const LOGO_SUBTITLES = [
  "CORP",
  "GROUP",
  "SYSTEMS",
  "HEAVY IND.",
  "ENERGY",
  "BIOTECH",
];

const FONT_STACK = '"Hiragino Sans", "Yu Gothic", "Arial Black", sans-serif';

type Rand = () => number;

function lcg(seedInit: number): Rand {
  let seed = seedInit >>> 0 || 1;
  return () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function pick<T>(arr: readonly T[], rand: Rand): T {
  return arr[Math.floor(rand() * arr.length)];
}

function katakanaString(rand: Rand, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += KATAKANA[Math.floor(rand() * KATAKANA.length)];
  }
  return s;
}

function brandName(rand: Rand, syllables: number): string {
  let s = "";
  for (let i = 0; i < syllables; i++) s += pick(BRAND_SYLLABLES, rand);
  return s.toUpperCase();
}

/** Lerp a hex color toward white — the hot "tube core" of a neon glow. */
function toCore(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) + (255 - ((n >> 16) & 0xff)) * t);
  const g = Math.round(((n >> 8) & 0xff) + (255 - ((n >> 8) & 0xff)) * t);
  const b = Math.round((n & 0xff) + (255 - (n & 0xff)) * t);
  return `rgb(${r},${g},${b})`;
}

/** Layered glow text: two colored halo passes + a near-white core pass. */
function glowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  color: string,
): void {
  ctx.font = `900 ${px}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.shadowBlur = px * 0.9;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = px * 0.45;
  ctx.fillText(text, x, y);
  ctx.fillStyle = toCore(color, 0.75);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = px * 0.15;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

/** Layered glow stroke for sign borders and logo glyphs. */
function glowStroke(
  ctx: CanvasRenderingContext2D,
  trace: () => void,
  color: string,
  lineWidth: number,
  blur: number,
): void {
  ctx.beginPath();
  trace();
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.shadowBlur = blur;
  ctx.stroke();
  ctx.shadowBlur = blur * 0.4;
  ctx.stroke();
  ctx.strokeStyle = toCore(color, 0.7);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = blur * 0.15;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function newCanvas(
  w: number,
  h: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext("2d")!];
}

/** Dark backing plate so the sign reads as a box, not floating glyphs. */
function backingPlate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "rgba(10,8,18,0.85)";
  ctx.beginPath();
  roundRectPath(ctx, 6, 6, w - 12, h - 12, 12);
  ctx.fill();
}

function borderTube(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
): void {
  glowStroke(ctx, () => roundRectPath(ctx, 14, 14, w - 28, h - 28, 10), color, 3.5, 16);
}

// ── Sign builders ────────────────────────────────────────────────────────────

function buildVertical(rand: Rand): HTMLCanvasElement {
  const W = 128;
  const H = 512;
  const [canvas, ctx] = newCanvas(W, H);
  const color = pick(NEON_PALETTE, rand);
  const second = pick(NEON_PALETTE, rand);

  if (rand() < 0.55) backingPlate(ctx, W, H);
  if (rand() < 0.65) borderTube(ctx, W, H, second);

  const n = 4 + Math.floor(rand() * 3); // 4-6 stacked characters
  const text = katakanaString(rand, n);
  const pad = 44;
  const step = (H - 2 * pad) / n;
  const px = Math.min(step * 0.8, 78);
  for (let i = 0; i < n; i++) {
    // Rare off-color character — a repaired tube in a different gas.
    const c = rand() < 0.12 ? second : color;
    glowText(ctx, text[i], W / 2, pad + step * (i + 0.5), px, c);
  }
  return canvas;
}

function buildHorizontal(rand: Rand): HTMLCanvasElement {
  const W = 512;
  const H = 128;
  const [canvas, ctx] = newCanvas(W, H);
  const color = pick(NEON_PALETTE, rand);
  const second = pick(NEON_PALETTE, rand);

  if (rand() < 0.45) backingPlate(ctx, W, H);
  if (rand() < 0.55) borderTube(ctx, W, H, second);

  const text =
    rand() < 0.4 ? brandName(rand, 2) : katakanaString(rand, 4 + Math.floor(rand() * 4));
  // Shrink until the text fits inside the border.
  let px = 72;
  ctx.font = `900 ${px}px ${FONT_STACK}`;
  while (px > 24 && ctx.measureText(text).width > W - 70) {
    px -= 4;
    ctx.font = `900 ${px}px ${FONT_STACK}`;
  }
  glowText(ctx, text, W / 2, H / 2, px, color);
  return canvas;
}

// One generated company identity, shared by all of its logo variants.
type CompanySpec = {
  name: string;
  color: string;
  second: string;
  shape: number;
  subtitle?: string;
};

function companySpec(rand: Rand): CompanySpec {
  return {
    name: brandName(rand, 1 + Math.floor(rand() * 2)).slice(0, 8),
    color: pick(NEON_PALETTE, rand),
    second: pick(NEON_PALETTE, rand),
    shape: Math.floor(rand() * 6),
    subtitle: rand() < 0.5 ? pick(LOGO_SUBTITLES, rand) : undefined,
  };
}

/** Letter-by-letter glow text with tracking — the channel-letter look. */
function trackedGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  px: number,
  gapRatio: number,
  color: string,
): void {
  ctx.font = `900 ${px}px ${FONT_STACK}`;
  const gap = px * gapRatio;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  for (let i = 0; i < text.length; i++) {
    glowText(ctx, text[i], x + widths[i] / 2, y, px, color);
    x += widths[i] + gap;
  }
}

function buildLogoWide(spec: CompanySpec, rand: Rand): HTMLCanvasElement {
  const W = 512;
  const H = 256;
  const [canvas, ctx] = newCanvas(W, H);
  const { color, second } = spec;

  // Abstract corporate glyph on the left.
  const cx = 104;
  const cy = 128;
  const r = 66;
  const shape = spec.shape;
  glowStroke(
    ctx,
    () => {
      switch (shape) {
        case 0: // circle + bar
          ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
          ctx.moveTo(cx - r, cy);
          ctx.lineTo(cx + r, cy);
          break;
        case 1: // triangle
          ctx.moveTo(cx, cy - r);
          ctx.lineTo(cx + r * 0.9, cy + r * 0.7);
          ctx.lineTo(cx - r * 0.9, cy + r * 0.7);
          ctx.closePath();
          break;
        case 2: // hexagon
          for (let i = 0; i <= 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const px2 = cx + Math.cos(a) * r * 0.85;
            const py2 = cy + Math.sin(a) * r * 0.85;
            if (i === 0) ctx.moveTo(px2, py2);
            else ctx.lineTo(px2, py2);
          }
          break;
        case 3: // diamond + dot
          ctx.moveTo(cx, cy - r);
          ctx.lineTo(cx + r * 0.7, cy);
          ctx.lineTo(cx, cy + r);
          ctx.lineTo(cx - r * 0.7, cy);
          ctx.closePath();
          ctx.moveTo(cx + 12, cy);
          ctx.arc(cx, cy, 12, 0, Math.PI * 2);
          break;
        case 4: // double ring
          ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
          ctx.moveTo(cx + r * 0.45, cy);
          ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
          break;
        default: // three bars
          for (const dx of [-36, 0, 36]) {
            ctx.moveTo(cx + dx, cy - r * 0.7);
            ctx.lineTo(cx + dx, cy + r * 0.7);
          }
      }
    },
    color,
    7,
    22,
  );

  // Company name to the right of the glyph.
  let px = 64;
  ctx.font = `900 ${px}px ${FONT_STACK}`;
  while (px > 28 && ctx.measureText(spec.name).width > 290) {
    px -= 4;
    ctx.font = `900 ${px}px ${FONT_STACK}`;
  }
  glowText(ctx, spec.name, 356, 112, px, toCore(color, 0.3));

  if (rand() < 0.6) {
    glowStroke(
      ctx,
      () => {
        ctx.moveTo(212, 160);
        ctx.lineTo(500, 160);
      },
      second,
      3,
      12,
    );
  }
  if (spec.subtitle) {
    glowText(ctx, spec.subtitle, 356, 196, 26, second);
  }
  return canvas;
}

function buildWordmarkText(spec: CompanySpec): HTMLCanvasElement {
  // Pure channel-letter wordmark (SONY / TRUIST style): no plate, no border,
  // just tracked glowing capitals.
  const W = 512;
  const H = 128;
  const [canvas, ctx] = newCanvas(W, H);
  let px = 80;
  const gapRatio = 0.22;
  ctx.font = `900 ${px}px ${FONT_STACK}`;
  const measure = () => {
    ctx.font = `900 ${px}px ${FONT_STACK}`;
    const widths = [...spec.name].map((ch) => ctx.measureText(ch).width);
    return (
      widths.reduce((s, w) => s + w, 0) + px * gapRatio * (spec.name.length - 1)
    );
  };
  while (px > 30 && measure() > 460) px -= 4;
  trackedGlowText(ctx, spec.name, W / 2, H / 2, px, gapRatio, spec.color);
  return canvas;
}

function buildWordmarkVertical(spec: CompanySpec): HTMLCanvasElement {
  // Letters stacked down the building edge (the vertical SONY on Ginza).
  const W = 128;
  const H = 512;
  const [canvas, ctx] = newCanvas(W, H);
  const text = spec.name.slice(0, 6);
  const n = text.length;
  const pad = 40;
  const step = (H - 2 * pad) / n;
  const px = Math.min(step * 0.78, 72);
  for (let i = 0; i < n; i++) {
    glowText(ctx, text[i], W / 2, pad + step * (i + 0.5), px, spec.color);
  }
  return canvas;
}

// ── Material registry & flicker animation ───────────────────────────────────

type FlickerState = {
  mat: MeshPhongMaterial;
  phase: number;
};

const materials = new Map<string, MeshPhongMaterial>();
const flickerStates: FlickerState[] = [];
let generated = false;

function makeMaterial(canvas: HTMLCanvasElement): MeshPhongMaterial {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Mirrors the small-ads PNG material recipe (manifests/materials.ts), with
  // a lower alphaTest so the soft glow halo isn't cut to a hard edge.
  return new MeshPhongMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: EMISSIVE_INTENSITY,
    transparent: true,
    alphaTest: 0.02,
    side: DoubleSide,
    depthWrite: true,
    fog: true,
  });
}

function ensureGenerated(): void {
  if (generated || typeof document === "undefined") return;
  generated = true;
  const rand = lcg(CATALOG_SEED);
  for (const meta of PROC_NEON_VERTICAL) {
    materials.set(meta.key, makeMaterial(buildVertical(rand)));
  }
  for (const meta of PROC_NEON_HORIZONTAL) {
    materials.set(meta.key, makeMaterial(buildHorizontal(rand)));
  }
  for (const family of PROC_LOGO_FAMILIES) {
    const spec = companySpec(rand);
    materials.set(family.wide.key, makeMaterial(buildLogoWide(spec, rand)));
    materials.set(family.text.key, makeMaterial(buildWordmarkText(spec)));
    materials.set(
      family.vertical.key,
      makeMaterial(buildWordmarkVertical(spec)),
    );
  }
  for (const meta of PROC_NEON_FLICKER) {
    const mat = makeMaterial(buildVertical(rand));
    materials.set(meta.key, mat);
    flickerStates.push({ mat, phase: rand() * 100 });
  }
}

/**
 * Resolve a procedural neon material by key. Returns undefined for non-pneon
 * keys so the caller can fall through to AssetManager materials.
 */
export function getProceduralAdMaterial(key: string): Material | undefined {
  if (!key.startsWith("pneon_")) return undefined;
  ensureGenerated();
  return materials.get(key);
}

/**
 * Look up the meta (key + aspect) for any procedural neon key — used by the
 * manual wall-ad resolver so `pneonKey` entries can size their planes
 * without hardcoding aspects. Pure data, safe before texture generation.
 */
export function getProceduralAdMeta(key: string): ProceduralAdMeta | undefined {
  for (const m of PROC_NEON_VERTICAL) if (m.key === key) return m;
  for (const m of PROC_NEON_HORIZONTAL) if (m.key === key) return m;
  for (const m of PROC_NEON_FLICKER) if (m.key === key) return m;
  for (const f of PROC_LOGO_FAMILIES) {
    if (f.wide.key === key) return f.wide;
    if (f.text.key === key) return f.text;
    if (f.vertical.key === key) return f.vertical;
  }
  return undefined;
}

/**
 * Animate the flicker signs. Mostly a faint idle buzz; periodically a sign
 * enters a "dying tube" window and stutters hard. Called once per frame by
 * FiniteCityWallAds with the elapsed clock time.
 */
export function tickNeonFlicker(timeSec: number): void {
  for (const f of flickerStates) {
    const t = timeSec + f.phase;
    const envelope = Math.sin(t * 0.9) * Math.sin(t * 0.233);
    let k: number;
    if (envelope > 0.8) {
      k = Math.sin(t * 57) > -0.3 ? 0.06 : 0.8;
    } else {
      k = 0.94 + 0.06 * Math.sin(t * 27) * Math.sin(t * 13.7);
    }
    f.mat.emissiveIntensity = EMISSIVE_INTENSITY * k;
  }
}
