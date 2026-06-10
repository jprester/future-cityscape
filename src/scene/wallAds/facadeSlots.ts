import type { BufferGeometry } from "three";

// ── Facade-slot scanner ──────────────────────────────────────────────────────
//
// Finds flat, unobstructed wall rectangles on a building model so ads can be
// placed procedurally without floating off recessed walls or clipping into
// stepped/tapered geometry — the reason big-building ad placement used to be
// manual-only.
//
// How: for each of the 4 cardinal faces, rasterize ALL triangles into a 2D
// grid over (along-wall, vertical) coordinates, keeping the front-most depth
// per cell (a software depth buffer looking at the facade square-on). Flat
// wall = contiguous region of near-constant depth; greedy region growth turns
// those into maximal rectangles. Cells covered by nothing (sky beside a
// silhouette) or by protruding geometry (fins, balconies, a lower tier's
// roofline) naturally split or shrink the rectangles, which is exactly the
// occlusion guarantee we need: every cell under a slot has the wall itself as
// its front-most surface.
//
// Everything is in MODEL-LOCAL units (geometry has node transforms pre-baked
// by AssetManager, origin = the building's placement anchor). The consumer
// applies the instance's scale/rotation/position.

export type FacadeSlot = {
  /** Cardinal face, same convention as WallAdManualEntry: outward normal is
   *  (sin(face·π/2), cos(face·π/2)) pre-rotation — 0:+Z 1:+X 2:−Z 3:−X. */
  face: 0 | 1 | 2 | 3;
  /** Slot center along the wall, on the face's tangent axis (the manual
   *  system's offsetSide axis: positive = right when facing the wall). */
  centerSide: number;
  /** Slot center height (local Y). */
  centerY: number;
  /** Slot extent along the wall. */
  width: number;
  /** Slot extent vertically. */
  height: number;
  /** Wall distance from the model origin along the outward normal (the
   *  manual system's offsetOut axis). Front-most depth within the slot, so a
   *  plane at depth + clearance clears every point of the wall. */
  depth: number;
};

// Grid resolution. 4 local units ≈ 4 world units on the (≈1-scale) towers —
// fine enough to catch tier steps, coarse enough to stay cheap.
const CELL = 4;
// Cells whose depth differs more than this from the slot's anchor are treated
// as a different wall plane. Absorbs window insets / panel trim; splits tiers.
const DEPTH_TOLERANCE = 1.5;
// Reject slots smaller than this (local units) — too small for a readable ad.
const MIN_SLOT_SIZE = 16;
// Keep only the biggest few slots per face; tiny leftovers add noise.
const MAX_SLOTS_PER_FACE = 4;
// Safety cap on grid size (cells) per face; CELL grows for huge models.
const MAX_GRID_CELLS = 90_000;

// face → local outward normal (n) and tangent (t). Matches resolveManual:
// out = (sin θ, cos θ), tangent = (cos θ, −sin θ) with θ = face·π/2.
const FACE_AXES: ReadonlyArray<{
  nx: number;
  nz: number;
  tx: number;
  tz: number;
}> = [
  { nx: 0, nz: 1, tx: 1, tz: 0 }, // 0: +Z
  { nx: 1, nz: 0, tx: 0, tz: -1 }, // 1: +X
  { nx: 0, nz: -1, tx: -1, tz: 0 }, // 2: −Z
  { nx: -1, nz: 0, tx: 0, tz: 1 }, // 3: −X
];

export function computeFacadeSlots(geometry: BufferGeometry): FacadeSlot[] {
  const posAttr = geometry.getAttribute("position");
  if (!posAttr) return [];
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : posAttr.count / 3;
  if (triCount === 0) return [];

  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return [];

  const vertIndex = (tri: number, corner: number): number =>
    index ? index.getX(tri * 3 + corner) : tri * 3 + corner;

  const slots: FacadeSlot[] = [];

  for (let face = 0 as 0 | 1 | 2 | 3; face < 4; face++) {
    const { nx, nz, tx, tz } = FACE_AXES[face];

    // Grid extents on the (s = tangent, y) plane.
    const sCorners = [
      tx * bbox.min.x + tz * bbox.min.z,
      tx * bbox.min.x + tz * bbox.max.z,
      tx * bbox.max.x + tz * bbox.min.z,
      tx * bbox.max.x + tz * bbox.max.z,
    ];
    const sMin = Math.min(...sCorners);
    const sMax = Math.max(...sCorners);
    const yMin = bbox.min.y;
    const yMax = bbox.max.y;

    let cell = CELL;
    let cols = Math.max(1, Math.ceil((sMax - sMin) / cell));
    let rows = Math.max(1, Math.ceil((yMax - yMin) / cell));
    while (cols * rows > MAX_GRID_CELLS) {
      cell *= 2;
      cols = Math.max(1, Math.ceil((sMax - sMin) / cell));
      rows = Math.max(1, Math.ceil((yMax - yMin) / cell));
    }

    // Front-most depth per cell; −Infinity = nothing covers this cell.
    const depth = new Float64Array(cols * rows).fill(-Infinity);

    // Rasterize every triangle (walls AND potential occluders) with
    // barycentric-interpolated depth at cell centers.
    for (let tri = 0; tri < triCount; tri++) {
      const i0 = vertIndex(tri, 0);
      const i1 = vertIndex(tri, 1);
      const i2 = vertIndex(tri, 2);

      const x0 = posAttr.getX(i0);
      const y0 = posAttr.getY(i0);
      const z0 = posAttr.getZ(i0);
      const x1 = posAttr.getX(i1);
      const y1 = posAttr.getY(i1);
      const z1 = posAttr.getZ(i1);
      const x2 = posAttr.getX(i2);
      const y2 = posAttr.getY(i2);
      const z2 = posAttr.getZ(i2);

      // Project onto the face plane: s along the wall, y up, d outward.
      const s0 = tx * x0 + tz * z0;
      const s1 = tx * x1 + tz * z1;
      const s2 = tx * x2 + tz * z2;
      const d0 = nx * x0 + nz * z0;
      const d1 = nx * x1 + nz * z1;
      const d2 = nx * x2 + nz * z2;

      // Signed area in the projection; ~0 = edge-on (floors, side walls) —
      // covers no cells, skip.
      const area = (s1 - s0) * (y2 - y0) - (s2 - s0) * (y1 - y0);
      if (Math.abs(area) < 1e-6) continue;
      const invArea = 1 / area;

      const cMin = Math.max(
        0,
        Math.floor((Math.min(s0, s1, s2) - sMin) / cell),
      );
      const cMax = Math.min(
        cols - 1,
        Math.floor((Math.max(s0, s1, s2) - sMin) / cell),
      );
      const rMin = Math.max(
        0,
        Math.floor((Math.min(y0, y1, y2) - yMin) / cell),
      );
      const rMax = Math.min(
        rows - 1,
        Math.floor((Math.max(y0, y1, y2) - yMin) / cell),
      );

      for (let r = rMin; r <= rMax; r++) {
        const yc = yMin + (r + 0.5) * cell;
        for (let c = cMin; c <= cMax; c++) {
          const sc = sMin + (c + 0.5) * cell;
          // Barycentric coordinates of the cell center.
          const w0 =
            ((s1 - sc) * (y2 - yc) - (s2 - sc) * (y1 - yc)) * invArea;
          const w1 =
            ((s2 - sc) * (y0 - yc) - (s0 - sc) * (y2 - yc)) * invArea;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const d = w0 * d0 + w1 * d1 + w2 * d2;
          const idx = r * cols + c;
          if (d > depth[idx]) depth[idx] = d;
        }
      }
    }

    // Greedy maximal-rectangle extraction over near-constant-depth regions.
    const visited = new Uint8Array(cols * rows);
    const faceSlots: FacadeSlot[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (visited[idx] || depth[idx] === -Infinity) continue;
        const dRef = depth[idx];

        // Grow right along the row.
        let w = 1;
        while (c + w < cols) {
          const i2 = r * cols + c + w;
          if (visited[i2] || Math.abs(depth[i2] - dRef) > DEPTH_TOLERANCE) {
            break;
          }
          w++;
        }
        // Grow down while the entire row span still matches.
        let h = 1;
        outer: while (r + h < rows) {
          const rowBase = (r + h) * cols;
          for (let cc = c; cc < c + w; cc++) {
            const i2 = rowBase + cc;
            if (visited[i2] || Math.abs(depth[i2] - dRef) > DEPTH_TOLERANCE) {
              break outer;
            }
          }
          h++;
        }

        // Mark consumed and record the front-most depth inside the rect.
        let dFront = -Infinity;
        for (let rr = r; rr < r + h; rr++) {
          for (let cc = c; cc < c + w; cc++) {
            const i2 = rr * cols + cc;
            visited[i2] = 1;
            if (depth[i2] > dFront) dFront = depth[i2];
          }
        }

        // Half-cell margin on each side: cell centers sampled the wall, the
        // outer half of an edge cell may already hang past the silhouette.
        const slotW = w * cell - cell;
        const slotH = h * cell - cell;
        if (slotW < MIN_SLOT_SIZE || slotH < MIN_SLOT_SIZE) continue;

        faceSlots.push({
          face,
          centerSide: sMin + (c + w / 2) * cell,
          centerY: yMin + (r + h / 2) * cell,
          width: slotW,
          height: slotH,
          depth: dFront,
        });
      }
    }

    faceSlots.sort((a, b) => b.width * b.height - a.width * a.height);
    const kept = faceSlots.slice(0, MAX_SLOTS_PER_FACE);
    // Always keep the face's TOPMOST slot too: on stepped towers the small
    // penthouse/parapet wall at the crown gets area-culled by the cap above,
    // but it's exactly where rooftop branding belongs.
    let topmost: FacadeSlot | null = null;
    for (const s of faceSlots) {
      if (
        !topmost ||
        s.centerY + s.height / 2 > topmost.centerY + topmost.height / 2
      ) {
        topmost = s;
      }
    }
    if (topmost && !kept.includes(topmost)) kept.push(topmost);
    slots.push(...kept);
  }

  return slots;
}
