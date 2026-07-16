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
//   • pictorial signs (2:3)   — blade-sign style: a hand-traced neon icon
//     (ramen bowl, martini glass, torii gate, koi, cyber-eye, lucky cat,
//     sake set, heart, dragon, rocket, dice, umbrella) over a themed caption
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
const PICTORIAL_COUNT = 14;
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
export const PROC_NEON_PICTORIAL: ProceduralAdMeta[] = makeMetas(
  "p",
  PICTORIAL_COUNT,
  2 / 3,
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

/** Small filled glow circle — eyes, olives, pips, indicator dots. */
function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  const dot = () => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.shadowBlur = r * 3;
  dot();
  ctx.shadowBlur = r * 1.2;
  dot();
  ctx.fillStyle = toCore(color, 0.7);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = r * 0.5;
  dot();
  ctx.shadowBlur = 0;
}

/** moveTo the start of an arc so a multi-subpath trace doesn't connect. */
function arcFrom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
  ccw = false,
): void {
  ctx.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
  ctx.arc(x, y, r, a0, a1, ccw);
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

// ── Pictorial signs ──────────────────────────────────────────────────────────
//
// Hand-traced neon icons, each drawn with the same layered-tube strokes as
// the text signs. A painter gets a center, a scale unit `s` (≈ half the icon
// extent), a primary tube color `a` and an accent color `b`.

type IconPainter = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  a: string,
  b: string,
  rand: Rand,
) => void;

type PictorialIcon = {
  paint: IconPainter;
  /** Themed captions; one is picked at random for the sign's text line. */
  captions: readonly string[];
};

const PICTORIAL_ICONS: readonly PictorialIcon[] = [
  {
    // Ramen bowl: bowl + rim + chopsticks, steam in the accent color.
    captions: ["ラーメン", "NOODLE", "麺屋"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          arcFrom(ctx, cx, cy, s * 0.78, 0, Math.PI);
          ctx.moveTo(cx - s * 0.78, cy);
          ctx.lineTo(cx + s * 0.78, cy);
          ctx.moveTo(cx - s * 0.28, cy + s * 0.88);
          ctx.lineTo(cx + s * 0.28, cy + s * 0.88);
          ctx.moveTo(cx - s * 0.15, cy - s * 0.05);
          ctx.lineTo(cx + s * 0.5, cy - s * 0.9);
          ctx.moveTo(cx + s * 0.02, cy - s * 0.02);
          ctx.lineTo(cx + s * 0.65, cy - s * 0.78);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          for (const dx of [-0.45, -0.15]) {
            ctx.moveTo(cx + s * dx, cy - s * 0.18);
            ctx.bezierCurveTo(
              cx + s * (dx - 0.12),
              cy - s * 0.4,
              cx + s * (dx + 0.12),
              cy - s * 0.55,
              cx + s * dx,
              cy - s * 0.8,
            );
          }
        },
        b,
        4,
        14,
      );
    },
  },
  {
    // Martini glass with olive on a pick.
    captions: ["BAR", "CLUB NOIR", "サケBAR"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx - s * 0.7, cy - s * 0.75);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + s * 0.7, cy - s * 0.75);
          ctx.moveTo(cx - s * 0.7, cy - s * 0.75);
          ctx.lineTo(cx + s * 0.7, cy - s * 0.75);
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, cy + s * 0.55);
          ctx.moveTo(cx - s * 0.32, cy + s * 0.55);
          ctx.lineTo(cx + s * 0.32, cy + s * 0.55);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx + s * 0.12, cy - s * 0.55);
          ctx.lineTo(cx + s * 0.4, cy - s * 0.92);
        },
        b,
        4,
        12,
      );
      glowDot(ctx, cx + s * 0.12, cy - s * 0.48, s * 0.1, b);
    },
  },
  {
    // Torii gate.
    captions: ["神社", "KYOTO", "ジンジャ"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx - s * 0.9, cy - s * 0.5);
          ctx.quadraticCurveTo(cx, cy - s * 0.68, cx + s * 0.9, cy - s * 0.5);
          ctx.moveTo(cx - s * 0.62, cy - s * 0.22);
          ctx.lineTo(cx + s * 0.62, cy - s * 0.22);
          ctx.moveTo(cx - s * 0.5, cy - s * 0.54);
          ctx.lineTo(cx - s * 0.58, cy + s * 0.8);
          ctx.moveTo(cx + s * 0.5, cy - s * 0.54);
          ctx.lineTo(cx + s * 0.58, cy + s * 0.8);
          ctx.moveTo(cx, cy - s * 0.6);
          ctx.lineTo(cx, cy - s * 0.22);
        },
        a,
        6,
        18,
      );
      glowDot(ctx, cx, cy + s * 0.25, s * 0.07, b);
    },
  },
  {
    // Koi fish, nose left, fan tail right; accent eye and scales.
    captions: ["寿司", "SUSHI", "KOI"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx - s * 0.8, cy);
          ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.55, cx + s * 0.35, cy - s * 0.12);
          ctx.lineTo(cx + s * 0.8, cy - s * 0.38);
          ctx.quadraticCurveTo(cx + s * 0.62, cy, cx + s * 0.8, cy + s * 0.38);
          ctx.lineTo(cx + s * 0.35, cy + s * 0.12);
          ctx.quadraticCurveTo(cx - s * 0.2, cy + s * 0.55, cx - s * 0.8, cy);
          ctx.moveTo(cx - s * 0.45, cy - s * 0.22);
          ctx.quadraticCurveTo(cx - s * 0.32, cy, cx - s * 0.45, cy + s * 0.22);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          arcFrom(ctx, cx - s * 0.05, cy, s * 0.17, -Math.PI * 0.4, Math.PI * 0.4);
          arcFrom(ctx, cx + s * 0.14, cy, s * 0.14, -Math.PI * 0.35, Math.PI * 0.35);
        },
        b,
        3.5,
        10,
      );
      glowDot(ctx, cx - s * 0.58, cy - s * 0.07, s * 0.05, b);
    },
  },
  {
    // Cyber-eye: almond + iris, circuit trace running off the corner.
    captions: ["OPTICS", "VISION+", "アイ・ラボ"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx - s * 0.85, cy);
          ctx.quadraticCurveTo(cx, cy - s * 0.62, cx + s * 0.85, cy);
          ctx.quadraticCurveTo(cx, cy + s * 0.62, cx - s * 0.85, cy);
          arcFrom(ctx, cx, cy, s * 0.3, 0, Math.PI * 2);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx + s * 0.85, cy);
          ctx.lineTo(cx + s * 0.95, cy + s * 0.2);
          ctx.lineTo(cx + s * 0.95, cy + s * 0.5);
        },
        b,
        3.5,
        12,
      );
      glowDot(ctx, cx, cy, s * 0.1, b);
      glowDot(ctx, cx + s * 0.95, cy + s * 0.58, s * 0.05, b);
    },
  },
  {
    // Lucky cat face: head + ears, accent whiskers and happy eyes.
    captions: ["招福", "LUCKY CAT", "パチンコ"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          arcFrom(ctx, cx, cy + s * 0.05, s * 0.55, 0, Math.PI * 2);
          ctx.moveTo(cx - s * 0.48, cy - s * 0.2);
          ctx.lineTo(cx - s * 0.62, cy - s * 0.78);
          ctx.lineTo(cx - s * 0.13, cy - s * 0.48);
          ctx.moveTo(cx + s * 0.48, cy - s * 0.2);
          ctx.lineTo(cx + s * 0.62, cy - s * 0.78);
          ctx.lineTo(cx + s * 0.13, cy - s * 0.48);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx - s * 0.6, cy + s * 0.02);
          ctx.lineTo(cx - s * 0.95, cy - s * 0.06);
          ctx.moveTo(cx - s * 0.6, cy + s * 0.16);
          ctx.lineTo(cx - s * 0.95, cy + s * 0.2);
          ctx.moveTo(cx + s * 0.6, cy + s * 0.02);
          ctx.lineTo(cx + s * 0.95, cy - s * 0.06);
          ctx.moveTo(cx + s * 0.6, cy + s * 0.16);
          ctx.lineTo(cx + s * 0.95, cy + s * 0.2);
          arcFrom(ctx, cx - s * 0.22, cy - s * 0.02, s * 0.1, Math.PI * 1.15, Math.PI * 1.85);
          arcFrom(ctx, cx + s * 0.22, cy - s * 0.02, s * 0.1, Math.PI * 1.15, Math.PI * 1.85);
        },
        b,
        3.5,
        10,
      );
      glowDot(ctx, cx, cy + s * 0.18, s * 0.05, b);
    },
  },
  {
    // Sake set: tokkuri bottle + cup, kanji accent.
    captions: ["居酒屋", "SAKE", "のみや"],
    paint: (ctx, cx, cy, s, a, b) => {
      const bx = cx - s * 0.3;
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(bx - s * 0.14, cy - s * 0.68);
          ctx.lineTo(bx - s * 0.09, cy - s * 0.4);
          ctx.quadraticCurveTo(bx - s * 0.45, cy - s * 0.1, bx - s * 0.38, cy + s * 0.35);
          ctx.quadraticCurveTo(bx - s * 0.34, cy + s * 0.62, bx, cy + s * 0.62);
          ctx.quadraticCurveTo(bx + s * 0.34, cy + s * 0.62, bx + s * 0.38, cy + s * 0.35);
          ctx.quadraticCurveTo(bx + s * 0.45, cy - s * 0.1, bx + s * 0.09, cy - s * 0.4);
          ctx.lineTo(bx + s * 0.14, cy - s * 0.68);
          ctx.moveTo(bx - s * 0.14, cy - s * 0.68);
          ctx.lineTo(bx + s * 0.14, cy - s * 0.68);
          const ux = cx + s * 0.48;
          const uy = cy + s * 0.32;
          ctx.moveTo(ux - s * 0.24, uy);
          ctx.quadraticCurveTo(ux - s * 0.2, uy + s * 0.28, ux, uy + s * 0.28);
          ctx.quadraticCurveTo(ux + s * 0.2, uy + s * 0.28, ux + s * 0.24, uy);
          ctx.moveTo(ux - s * 0.24, uy);
          ctx.lineTo(ux + s * 0.24, uy);
        },
        a,
        6,
        18,
      );
      glowText(ctx, "酒", cx + s * 0.45, cy - s * 0.45, s * 0.5, b);
    },
  },
  {
    // Heart pierced by an arrow.
    captions: ["HOTEL", "ホテル", "LOVE"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx, cy + s * 0.6);
          ctx.bezierCurveTo(cx - s, cy - s * 0.1, cx - s * 0.55, cy - s * 0.75, cx, cy - s * 0.25);
          ctx.bezierCurveTo(cx + s * 0.55, cy - s * 0.75, cx + s, cy - s * 0.1, cx, cy + s * 0.6);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx - s * 0.85, cy + s * 0.5);
          ctx.lineTo(cx + s * 0.85, cy - s * 0.55);
          ctx.moveTo(cx + s * 0.85, cy - s * 0.55);
          ctx.lineTo(cx + s * 0.6, cy - s * 0.52);
          ctx.moveTo(cx + s * 0.85, cy - s * 0.55);
          ctx.lineTo(cx + s * 0.78, cy - s * 0.32);
          ctx.moveTo(cx - s * 0.85, cy + s * 0.5);
          ctx.lineTo(cx - s * 0.68, cy + s * 0.52);
          ctx.moveTo(cx - s * 0.85, cy + s * 0.5);
          ctx.lineTo(cx - s * 0.8, cy + s * 0.32);
        },
        b,
        4,
        12,
      );
    },
  },
  {
    // Serpent dragon: S-curve body, open jaw, horn, accent whisker.
    captions: ["龍", "DRAGON", "中華楼"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx - s * 0.75, cy + s * 0.7);
          ctx.bezierCurveTo(cx - s * 0.1, cy + s * 0.55, cx - s * 0.55, cy + s * 0.05, cx + s * 0.05, cy - s * 0.02);
          ctx.bezierCurveTo(cx + s * 0.6, cy - s * 0.08, cx + s * 0.1, cy - s * 0.5, cx + s * 0.55, cy - s * 0.62);
          ctx.lineTo(cx + s * 0.82, cy - s * 0.55);
          ctx.lineTo(cx + s * 0.6, cy - s * 0.4);
          ctx.moveTo(cx + s * 0.55, cy - s * 0.62);
          ctx.lineTo(cx + s * 0.45, cy - s * 0.85);
          // dorsal spikes
          ctx.moveTo(cx - s * 0.45, cy + s * 0.52);
          ctx.lineTo(cx - s * 0.52, cy + s * 0.34);
          ctx.moveTo(cx - s * 0.1, cy + s * 0.28);
          ctx.lineTo(cx - s * 0.22, cy + s * 0.14);
          ctx.moveTo(cx + s * 0.3, cy - s * 0.18);
          ctx.lineTo(cx + s * 0.18, cy - s * 0.32);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx + s * 0.82, cy - s * 0.55);
          ctx.quadraticCurveTo(cx + s * 0.97, cy - s * 0.45, cx + s * 0.88, cy - s * 0.28);
        },
        b,
        3.5,
        10,
      );
      glowDot(ctx, cx + s * 0.58, cy - s * 0.55, s * 0.05, b);
    },
  },
  {
    // Rocket with porthole and exhaust flame.
    captions: ["ARCADE", "ロケット", "GAME ON"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(cx - s * 0.28, cy + s * 0.35);
          ctx.lineTo(cx - s * 0.28, cy - s * 0.15);
          ctx.quadraticCurveTo(cx - s * 0.28, cy - s * 0.7, cx, cy - s * 0.88);
          ctx.quadraticCurveTo(cx + s * 0.28, cy - s * 0.7, cx + s * 0.28, cy - s * 0.15);
          ctx.lineTo(cx + s * 0.28, cy + s * 0.35);
          ctx.closePath();
          ctx.moveTo(cx - s * 0.28, cy + s * 0.05);
          ctx.lineTo(cx - s * 0.55, cy + s * 0.45);
          ctx.lineTo(cx - s * 0.28, cy + s * 0.35);
          ctx.moveTo(cx + s * 0.28, cy + s * 0.05);
          ctx.lineTo(cx + s * 0.55, cy + s * 0.45);
          ctx.lineTo(cx + s * 0.28, cy + s * 0.35);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          arcFrom(ctx, cx, cy - s * 0.3, s * 0.13, 0, Math.PI * 2);
          ctx.moveTo(cx - s * 0.15, cy + s * 0.42);
          ctx.lineTo(cx - s * 0.06, cy + s * 0.62);
          ctx.lineTo(cx + s * 0.02, cy + s * 0.45);
          ctx.lineTo(cx + s * 0.1, cy + s * 0.68);
          ctx.lineTo(cx + s * 0.15, cy + s * 0.42);
        },
        b,
        3.5,
        12,
      );
    },
  },
  {
    // Pair of dice, one tilted; pips in the accent color.
    captions: ["CASINO", "カジノ", "777"],
    paint: (ctx, cx, cy, s, a, b) => {
      const h1 = s * 0.34;
      const d1x = cx - s * 0.32;
      const d1y = cy - s * 0.18;
      const d2x = cx + s * 0.36;
      const d2y = cy + s * 0.3;
      const rot = 0.32;
      glowStroke(
        ctx,
        () => {
          roundRectPath(ctx, d1x - h1, d1y - h1, h1 * 2, h1 * 2, 8);
          ctx.save();
          ctx.translate(d2x, d2y);
          ctx.rotate(rot);
          roundRectPath(ctx, -h1 * 0.9, -h1 * 0.9, h1 * 1.8, h1 * 1.8, 8);
          ctx.restore();
        },
        a,
        6,
        18,
      );
      const p = s * 0.16;
      glowDot(ctx, d1x - p, d1y - p, s * 0.055, b);
      glowDot(ctx, d1x, d1y, s * 0.055, b);
      glowDot(ctx, d1x + p, d1y + p, s * 0.055, b);
      const c = Math.cos(rot);
      const n = Math.sin(rot);
      const q = s * 0.13;
      glowDot(ctx, d2x + (-q * c - -q * n), d2y + (-q * n + -q * c), s * 0.05, b);
      glowDot(ctx, d2x + (q * c - q * n), d2y + (q * n + q * c), s * 0.05, b);
    },
  },
  {
    // Umbrella with hooked handle, rain ticks in the accent color.
    captions: ["RAIN BAR", "アメヤ", "傘"],
    paint: (ctx, cx, cy, s, a, b) => {
      glowStroke(
        ctx,
        () => {
          arcFrom(ctx, cx, cy + s * 0.05, s * 0.78, Math.PI, Math.PI * 2);
          for (let i = 0; i < 4; i++) {
            arcFrom(ctx, cx - s * 0.585 + i * s * 0.39, cy + s * 0.05, s * 0.195, 0, Math.PI);
          }
          ctx.moveTo(cx, cy - s * 0.9);
          ctx.lineTo(cx, cy + s * 0.55);
          arcFrom(ctx, cx + s * 0.12, cy + s * 0.55, s * 0.12, Math.PI, 0, true);
        },
        a,
        6,
        18,
      );
      glowStroke(
        ctx,
        () => {
          for (const [dx, dy] of [
            [-0.95, -0.35],
            [0.9, -0.5],
            [0.72, 0.15],
          ]) {
            ctx.moveTo(cx + s * dx, cy + s * dy);
            ctx.lineTo(cx + s * (dx + 0.08), cy + s * (dy + 0.22));
          }
        },
        b,
        3.5,
        10,
      );
    },
  },
];

/** One blade-style pictorial sign: plate + border + icon + themed caption. */
function buildPictorial(rand: Rand, index: number): HTMLCanvasElement {
  const W = 256;
  const H = 384;
  const [canvas, ctx] = newCanvas(W, H);
  const icon = PICTORIAL_ICONS[index % PICTORIAL_ICONS.length];
  const a = pick(NEON_PALETTE, rand);
  const b = pick(NEON_PALETTE, rand);

  if (rand() < 0.8) backingPlate(ctx, W, H);
  if (rand() < 0.75) borderTube(ctx, W, H, rand() < 0.5 ? b : a);

  const withCaption = rand() < 0.8;
  if (withCaption) {
    icon.paint(ctx, W / 2, 150, 78, a, b, rand);
    const caption = pick(icon.captions, rand);
    // Caption tube in whichever color the icon body didn't lead with.
    let px = 44;
    ctx.font = `900 ${px}px ${FONT_STACK}`;
    while (px > 20 && ctx.measureText(caption).width > W - 56) {
      px -= 3;
      ctx.font = `900 ${px}px ${FONT_STACK}`;
    }
    glowText(ctx, caption, W / 2, 310, px, rand() < 0.4 ? b : a);
  } else {
    icon.paint(ctx, W / 2, H / 2, 95, a, b, rand);
  }
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
  // Separate stream so adding pictorials doesn't reshuffle the signs above.
  const prand = lcg(CATALOG_SEED ^ 0x5eed);
  PROC_NEON_PICTORIAL.forEach((meta, i) => {
    materials.set(meta.key, makeMaterial(buildPictorial(prand, i)));
  });
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
  for (const m of PROC_NEON_PICTORIAL) if (m.key === key) return m;
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
