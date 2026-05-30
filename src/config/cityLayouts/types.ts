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
  spawn: { x: number; z: number; rotationY: number };
  buildings: FiniteBuildingPlacement[];
  megaBuildings?: FiniteMegaPlacement[];
  groundTiles: { x: number; z: number }[];
  storefronts: FiniteStorefrontPlacement[];
};
