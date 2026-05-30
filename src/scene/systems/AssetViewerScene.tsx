import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { NoToneMapping, SRGBColorSpace } from "three";
import type { BufferGeometry, Material } from "three";
import { Game } from "../../classes/Game.js";
import { useGameStore } from "../../context/GameContext";
import {
  getAllModelKeys,
  getEmbeddedMaterialKeys,
} from "../../config/buildingRegistry";
import { COLORS } from "../../constants/colors";

// All building model keys and embedded material set from registry
const ALL_KEYS = getAllModelKeys();
const EMBEDDED = getEmbeddedMaterialKeys();

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

type ResolvedModel = {
  key: string;
  geometry: BufferGeometry;
  material: Material | Material[];
};

type AssetViewerContentProps = {
  viewMode: "single" | "gallery";
  currentIndex: number;
};

/** Resolve geometry+material for a building key */
function resolveModel(
  key: string,
  getModel: (k: string) => BufferGeometry | undefined,
  getMaterial: (k: string) => Material | Material[] | undefined,
): ResolvedModel | null {
  const geometry = getModel(key);
  if (!geometry) return null;

  if (EMBEDDED.has(key)) {
    const material = getMaterial(`__embedded_${key}`);
    if (!material) return null;
    return { key, geometry, material };
  }

  // OBJ model — pick the first available shared material
  for (const matKey of SHARED_MATERIALS) {
    const material = getMaterial(matKey);
    if (material) return { key, geometry, material };
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

/** Single building view */
function SingleView({ model }: { model: ResolvedModel }) {
  return (
    <mesh geometry={model.geometry} material={model.material} position={[0, 0, 0]} />
  );
}

/** Gallery view — grid of all buildings */
function GalleryView({ models }: { models: ResolvedModel[] }) {
  const COLS = 4;
  const SPACING = 200;

  return (
    <>
      {models.map((model, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = (col - (COLS - 1) / 2) * SPACING;
        const z = row * SPACING;

        return (
          <group key={model.key} position={[x, 0, z]}>
            <mesh geometry={model.geometry} material={model.material} />
            <Html position={[0, -5, 0]} center style={{ pointerEvents: "none" }}>
              <div
                style={{
                  color: "#00fff7",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  textShadow: "0 0 8px #00fff7",
                }}
              >
                {model.key}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function SceneContent({ viewMode, currentIndex }: AssetViewerContentProps) {
  const { gameRef, launchReady } = useGameStore();

  // Resolve all models once assets are loaded
  const resolvedModels = useMemo(() => {
    if (!launchReady || !gameRef.current?.assets) return [];

    const assets = gameRef.current.assets;
    const models: ResolvedModel[] = [];

    for (const key of ALL_KEYS) {
      const resolved = resolveModel(
        key,
        (k) => assets.getModel(k),
        (k) => assets.getMaterial(k),
      );
      if (resolved) models.push(resolved);
    }

    return models;
  }, [launchReady, gameRef]);

  if (!launchReady || resolvedModels.length === 0) {
    return null;
  }

  const currentModel = resolvedModels[currentIndex % resolvedModels.length];

  return viewMode === "single" ? (
    <SingleView model={currentModel} />
  ) : (
    <GalleryView models={resolvedModels} />
  );
}

export default function AssetViewerScene({
  viewMode,
  currentIndex,
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
        enableDamping
        dampingFactor={0.1}
        maxPolarAngle={Math.PI / 2}
        minDistance={10}
        maxDistance={1500}
      />

      <SceneContent viewMode={viewMode} currentIndex={currentIndex} />
    </Canvas>
  );
}
