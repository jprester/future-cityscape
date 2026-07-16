import { useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bounds, OrbitControls, Html } from "@react-three/drei";
import { NoToneMapping, SRGBColorSpace } from "three";
import type { BufferGeometry, Material } from "three";
import { Game } from "../../classes/Game.js";
import { useGameStore } from "../../context/GameContext";
import {
  getEmbeddedMaterialKeys,
  getModelMaterialKeys,
} from "../../config/buildingRegistry";
import {
  getProceduralAdMaterial,
  tickNeonFlicker,
} from "../wallAds/proceduralNeon";
import {
  getViewerItems,
  type ViewerCategory,
  type ViewerItem,
} from "./assetViewerCatalog";
import { COLORS } from "../../constants/colors";

const EMBEDDED = getEmbeddedMaterialKeys();
const MODEL_MATERIALS = getModelMaterialKeys();

// Shared texture material keys (for OBJ models)
const SHARED_MATERIALS = [
  "building_01",
  "building_02",
  "building_03",
  "building_04",
  "building_05",
  "building_06",
  "building_07",
  "building_08",
  "building_09",
  "building_10",
];

// Sign planes are normalized so their longest edge spans this many units.
const SIGN_SIZE = 60;

type ResolvedItem = {
  item: ViewerItem;
  /** Set for kind "model" items. */
  geometry?: BufferGeometry;
  material: Material | Material[];
};

type AssetViewerContentProps = {
  category: ViewerCategory;
  viewMode: "single" | "gallery";
  currentIndex: number;
  showLabels: boolean;
};

/** Resolve geometry+material for a building model key */
function resolveModel(
  key: string,
  getModel: (k: string) => BufferGeometry | undefined,
  getMaterial: (k: string) => Material | Material[] | undefined,
): { geometry: BufferGeometry; material: Material | Material[] } | null {
  const geometry = getModel(key);
  if (!geometry) return null;

  if (EMBEDDED.has(key)) {
    const material = getMaterial(`__embedded_${key}`);
    if (!material) return null;
    return { geometry, material };
  }

  const sharedMaterialKey = MODEL_MATERIALS.get(key);
  if (sharedMaterialKey) {
    const material = getMaterial(sharedMaterialKey);
    if (!material) return null;
    return { geometry, material };
  }

  // OBJ model — pick the first available shared material
  for (const matKey of SHARED_MATERIALS) {
    const material = getMaterial(matKey);
    if (material) return { geometry, material };
  }
  return null;
}

/** Setup renderer (runs once inside Canvas) */
function RendererSetup() {
  const { gl } = useThree();

  useEffect(() => {
    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.outputColorSpace = SRGBColorSpace;
  }, [gl]);

  return null;
}

/** Asset loader bridge — creates Game instance for loading only */
function AssetLoader() {
  const { gameRef, setLaunchReady } = useGameStore();
  const { camera, gl } = useThree();

  useEffect(() => {
    if (gameRef.current) return;

    const game = new Game({
      camera,
      canvas: gl.domElement,
      settings: { mode: "freeroam" },
      terminal: null,
      controller: null,
      onAssetsLoaded: () => setLaunchReady(true),
      onCrashChange: () => {},
    });
    gameRef.current = game;
    game.load();
  }, [camera, gl, gameRef, setLaunchReady]);

  return null;
}

/** Drives the procedural-neon flicker materials (same call the city makes). */
function NeonFlickerTick() {
  useFrame(({ clock }) => tickNeonFlicker(clock.elapsedTime));
  return null;
}

/** Fit a sign plane inside SIGN_SIZE keeping its aspect ratio. */
function planeSize(aspect: number): [number, number] {
  return aspect >= 1
    ? [SIGN_SIZE, SIGN_SIZE / aspect]
    : [SIGN_SIZE * aspect, SIGN_SIZE];
}

function ItemMesh({ resolved }: { resolved: ResolvedItem }) {
  if (resolved.item.kind === "model") {
    return <mesh geometry={resolved.geometry} material={resolved.material} />;
  }
  const [w, h] = planeSize(resolved.item.aspect);
  return (
    <mesh material={resolved.material} position={[0, h / 2 + 4, 0]}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

/** Gallery view — grid of all items in the category */
function GalleryView({
  items,
  showLabels,
}: {
  items: ResolvedItem[];
  showLabels: boolean;
}) {
  const isModels = items[0]?.item.kind === "model";
  const COLS = isModels ? 4 : 6;
  const SPACING = isModels ? 200 : 90;

  return (
    <>
      {items.map((resolved, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = (col - (COLS - 1) / 2) * SPACING;
        const z = row * SPACING;

        return (
          <group key={resolved.item.key} position={[x, 0, z]}>
            <ItemMesh resolved={resolved} />
            {showLabels && (
              <Html
                position={[0, -5, 0]}
                center
                style={{ pointerEvents: "none" }}
              >
                <div
                  style={{
                    color: "#00fff7",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                    textShadow: "0 0 8px #00fff7",
                  }}
                >
                  {resolved.item.key}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function SceneContent({
  category,
  viewMode,
  currentIndex,
  showLabels,
}: AssetViewerContentProps) {
  const { gameRef, launchReady } = useGameStore();

  // Resolve every catalog item to a renderable geometry/material pair.
  const resolvedItems = useMemo(() => {
    if (!launchReady || !gameRef.current?.assets) return [];

    const assets = gameRef.current.assets;
    const resolved: ResolvedItem[] = [];

    for (const item of getViewerItems(category)) {
      if (item.kind === "model") {
        const model = resolveModel(
          item.key,
          (k) => assets.getModel(k),
          (k) => assets.getMaterial(k),
        );
        if (model) resolved.push({ item, ...model });
      } else {
        // Procedural neon materials live outside AssetManager.
        const material =
          getProceduralAdMaterial(item.key) ?? assets.getMaterial(item.key);
        if (material) resolved.push({ item, material });
      }
    }

    return resolved;
  }, [category, launchReady, gameRef]);

  if (!launchReady || resolvedItems.length === 0) {
    return null;
  }

  const current = resolvedItems[currentIndex % resolvedItems.length];

  return (
    <>
      {category === "neon" && <NeonFlickerTick />}
      {viewMode === "single" ? (
        <Bounds key={current.item.key} fit clip observe margin={1.25}>
          <ItemMesh resolved={current} />
        </Bounds>
      ) : (
        <GalleryView items={resolvedItems} showLabels={showLabels} />
      )}
    </>
  );
}

export default function AssetViewerScene({
  category,
  viewMode,
  currentIndex,
  showLabels,
}: AssetViewerContentProps) {
  return (
    <Canvas
      style={{ position: "fixed", inset: 0, zIndex: 0, background: "#0a0a1a" }}
      camera={{ position: [150, 120, 150], fov: 50, near: 0.1, far: 5000 }}
    >
      <RendererSetup />
      <AssetLoader />

      {/* Lighting — night environment values */}
      <ambientLight intensity={0.5} color={COLORS.night.ambient} />
      <directionalLight
        intensity={0.8}
        color={0xffffff}
        position={[100, 200, 100]}
      />
      <directionalLight
        intensity={0.3}
        color={COLORS.night.sun}
        position={[-50, 100, -50]}
      />

      {/* Ground grid */}
      <gridHelper args={[2000, 40, 0x333366, 0x1a1a3a]} />

      {/* Orbit controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        maxPolarAngle={Math.PI / 2}
        minDistance={10}
        maxDistance={1500}
      />

      <SceneContent
        category={category}
        viewMode={viewMode}
        currentIndex={currentIndex}
        showLabels={showLabels}
      />
    </Canvas>
  );
}
