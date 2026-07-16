export type FiniteBuildingPlacement = {
  modelKey: string;
  materialKey: string;
  x: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationY: number;
  /** Grid coordinates from CITY_TEMPLATE (gi=col, gj=row). Optional so
   *  externally-loaded layouts without this field still parse. */
  gi?: number;
  gj?: number;
};

export type FiniteMegaPlacement = {
  modelKey: string;
  x: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationY: number;
};

export type FiniteStorefrontPlacement = {
  x: number;
  z: number;
  materialKey: string;
};

export type FiniteCityLayout = {
  name: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: {
    x: number;
    z: number;
    rotationY: number;
    /** Explicit eye-height Y (world units). Takes precedence over roof* below. */
    y?: number;
    /**
     * Rooftop spawn: model key + Y scale of the building to stand on. The roof
     * height (eye Y) is resolved at runtime from the model's bounding box, since
     * GLB geometry sizes aren't known at layout-generation time.
     */
    roofModelKey?: string;
    roofScaleY?: number;
  };
  /**
   * Procedural rooftop vantage platform (the perch the player spawns on). A
   * simple flat-topped box tower built in code instead of a detailed GLB, so
   * its roof is guaranteed flat and its footprint exact — that makes the
   * edge-blocking in Player.update reliable (a tapered GLB roof let the player
   * walk off). Rendered + collided by FiniteCitySystem's vantage component.
   */
  vantage?: {
    x: number;
    z: number;
    width: number;
    depth: number;
    /** World-unit Y of the flat roof surface (top of the box). */
    roofY: number;
  };
  buildings: FiniteBuildingPlacement[];
  megaBuildings?: FiniteMegaPlacement[];
  groundTiles: { x: number; z: number }[];
  storefronts: FiniteStorefrontPlacement[];
};
