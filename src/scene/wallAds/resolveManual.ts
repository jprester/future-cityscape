import type { FiniteCityLayout } from "../../config/cityLayouts";
import { adMatKey, findAdMeta } from "../../config/ads";
import { WALL_AD_DEFAULTS, WALL_ADS_MANUAL } from "./manual";
import type { WallAd } from "./types";

/**
 * Turn the WALL_ADS_MANUAL entries into concrete WallAd render states.
 * Skips entries whose target cell has no tower/skyscraper (logged once).
 */
export function resolveManualWallAds(layout: FiniteCityLayout): WallAd[] {
  const ads: WallAd[] = [];

  // Index buildings by (gi, gj) so each manual entry can find its target
  // in O(1). Small buildings share a parent block's coords (2×2 sub-grid),
  // so we only keep the first per cell — manual entries should target
  // tower/skyscraper cells anyway.
  const buildingByCell = new Map<
    string,
    FiniteCityLayout["buildings"][number]
  >();
  for (const b of layout.buildings) {
    if (b.gi === undefined || b.gj === undefined) continue;
    const k = `${b.gi},${b.gj}`;
    if (!buildingByCell.has(k)) buildingByCell.set(k, b);
  }

  for (const entry of WALL_ADS_MANUAL) {
    const b = buildingByCell.get(`${entry.gi},${entry.gj}`);
    if (!b) {
      console.warn(
        `[WALL_ADS_MANUAL] No building at (gi=${entry.gi}, gj=${entry.gj})`,
      );
      continue;
    }

    const meta = findAdMeta(entry.adId);
    if (!meta) {
      console.warn(`[WALL_ADS_MANUAL] Unknown adId: ${entry.adId}`);
      continue;
    }

    const style = entry.style ?? "holo";
    const face = entry.face ?? WALL_AD_DEFAULTS.face;
    const offsetOut = entry.offsetOut ?? WALL_AD_DEFAULTS.offsetOut;
    const offsetSide = entry.offsetSide ?? 0;
    const y = entry.y ?? WALL_AD_DEFAULTS.y;
    const height = entry.height ?? WALL_AD_DEFAULTS.height;
    const width = entry.width ?? height * meta.aspect;

    // Face index → angle around Y. The plane faces +Z by default; we
    // rotate it so its normal points outward from the chosen building face,
    // then add the building's own rotation and any per-entry tweak.
    const faceAngle = (face * Math.PI) / 2;
    const totalAngle = b.rotationY + faceAngle + (entry.rotationOffset ?? 0);

    // Out vector points away from the wall; tangent points along the wall
    // (perpendicular to "out", in the horizontal plane). Positive
    // offsetSide slides the ad to the viewer's right when facing the wall.
    const outX = Math.sin(totalAngle);
    const outZ = Math.cos(totalAngle);
    const tangentX = Math.cos(totalAngle);
    const tangentZ = -Math.sin(totalAngle);

    const isBillboard = style === "billboard";

    ads.push({
      matKey: adMatKey(entry.adId, style),
      aspect: meta.aspect,
      x: b.x + outX * offsetOut + tangentX * offsetSide,
      y,
      z: b.z + outZ * offsetOut + tangentZ * offsetSide,
      width,
      height,
      rotationY: totalAngle,
      rotationX: entry.tilt ?? 0,
      emissiveIntensityMul: entry.emissiveIntensity,
      emissiveColor: entry.emissiveColor,
      // Holo-only overrides — silently ignored in billboard mode.
      opacity: isBillboard ? undefined : entry.opacity,
      cutBackground: isBillboard ? undefined : entry.cutBackground,
      alphaTestOverride: isBillboard ? undefined : entry.alphaTest,
    });
  }

  return ads;
}
