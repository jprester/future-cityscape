import { lazy, Suspense, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  FogExp2,
  NoToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
} from "three";
import { Game } from "../../classes/Game.js";
import { useGameStore } from "../../context/GameContext";
import { usePlayerController } from "../../controllers/usePlayerController";
import type { EnvironmentConfig } from "../../config/environments";
import type { GameRuntime } from "../../types/game";
import { EnhancedEffects, getPreset } from "../effects";

// Dev-only Leva-driven effects wrapper. Excluded from prod (DEV is statically
// false there, so this lazy branch and Leva are dropped from the bundle).
const DevEffects = import.meta.env.DEV
  ? lazy(() => import("../dev/DevEffects"))
  : null;

export function GameBridge() {
  const { gl, scene, camera, set, size } = useThree();
  const {
    settings,
    quickstart,
    gameRef,
    terminalRef,
    launchReady,
    setLaunchReady,
  } = useGameStore();
  const controller = usePlayerController();
  const [environment, setEnvironment] = useState<EnvironmentConfig | null>(
    null,
  );

  useEffect(() => {
    if (gameRef.current) {
      return;
    }

    const game = new Game({
      camera,
      canvas: gl.domElement,
      settings,
      terminal: terminalRef.current,
      controller,
      onAssetsLoaded: () => setLaunchReady(true),
    }) as unknown as GameRuntime;
    gameRef.current = game;
    setEnvironment(game.environment);

    // DEV-only handle for debugging / headless tooling (e.g. aiming the camera
    // for verification screenshots). Stripped from production builds.
    if (import.meta.env.DEV) {
      (window as unknown as { game?: unknown }).game = game;
    }

    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.outputColorSpace = SRGBColorSpace;
    // Only enable the shadow map (and its per-material shader cost) when the
    // active environment actually casts shadows. Night skips it entirely.
    gl.shadowMap.enabled = game.environment.shadows;
    gl.shadowMap.type = PCFSoftShadowMap;

    // In quickstart mode, start loading assets immediately (no terminal boot delay)
    if (quickstart) {
      game.load();
    }
  }, [gl, scene, camera, settings, gameRef, terminalRef]);

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.setSettings(settings);
    }
  }, [settings, gameRef]);

  // Update emissive intensities when visual preset or quality level changes
  // Medium quality reduces bloom intensity by 0.7x, so we compensate by increasing
  // emissive intensity to maintain visual consistency across quality levels
  useEffect(() => {
    const game = gameRef.current;
    if (!game?.assets?.updateEmissiveIntensities) {
      return;
    }
    const preset = getPreset(settings.visualPreset);
    // Compensate for reduced bloom on medium quality (bloom is 0.7x, so emissive ~1.4x)
    const qualityEmissiveMultiplier =
      settings.qualityLevel === "medium" ? 1.4 : 1.0;
    const adjustedEmissive = {
      ads: preset.emissive.ads * qualityEmissiveMultiplier,
      buildings: preset.emissive.buildings * qualityEmissiveMultiplier,
      neons: preset.emissive.neons * qualityEmissiveMultiplier,
      ambient: preset.emissive.ambient * qualityEmissiveMultiplier,
      smoke: preset.emissive.smoke * qualityEmissiveMultiplier,
    };
    game.assets.updateEmissiveIntensities(adjustedEmissive);
  }, [settings.visualPreset, settings.qualityLevel, launchReady, gameRef]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game || !game.player?.camera) {
      return;
    }
    game.player.camera.aspect = size.width / size.height;
    game.player.camera.updateProjectionMatrix();
  }, [size, gameRef]);

  useEffect(() => {
    if (!environment || !gameRef.current) {
      return;
    }

    scene.fog = new FogExp2(environment.fog.color, environment.fog.density);
  }, [environment, scene, gameRef]);

  useEffect(() => {
    if (!environment || !launchReady) {
      return;
    }

    const game = gameRef.current;
    if (!game?.assets) {
      return;
    }

    const skyTexture = game.assets.getTexture(environment.sky);
    if (skyTexture) {
      scene.background = skyTexture;
      scene.backgroundIntensity = environment.backgroundIntensity;
    }

    const envMap = game.assets.getTexture(environment.environmentMap);
    if (envMap) {
      scene.environment = envMap;
      // three r162+ lights MeshPhong/Lambert from scene.environment too (it
      // didn't ≤0.159). PBR buildings use their own explicit envMap, so this
      // only scales the env contribution to the Phong ads/OBJ buildings.
      scene.environmentIntensity = environment.environmentIntensity;
    }
  }, [environment, launchReady, scene, gameRef]);

  useFrame(() => {
    const game = gameRef.current;
    if (!game || !game.isRunning) {
      return;
    }

    if (game.player?.camera && camera !== game.player.camera) {
      set({ camera: game.player.camera });
    }
  }, 1);

  // Smaller shadow map on lower quality tiers (only used when shadows are on).
  const shadowMapSize = settings.qualityLevel === "high" ? 2048 : 1024;

  return (
    <>
      {environment && (
        <>
          <ambientLight
            intensity={environment.ambient.intensity}
            color={environment.ambient.color}
          />
          <directionalLight
            castShadow={environment.shadows}
            intensity={environment.sun.intensity}
            color={environment.sun.color}
            position={[environment.sun.x, environment.sun.y, environment.sun.z]}
            shadow-mapSize-width={shadowMapSize}
            shadow-mapSize-height={shadowMapSize}
            shadow-camera-near={0.5}
            shadow-camera-far={1500}
            shadow-camera-left={-500}
            shadow-camera-right={500}
            shadow-camera-top={500}
            shadow-camera-bottom={-500}
            shadow-bias={-0.0005}
          />
        </>
      )}
      {DevEffects ? (
        <Suspense fallback={null}>
          <DevEffects
            isDay={environment?.name === "day"}
            enabled={true}
            qualityLevel={settings.qualityLevel}
            defaultPresetId={settings.visualPreset}
          />
        </Suspense>
      ) : (
        <EnhancedEffects
          preset={getPreset(settings.visualPreset)}
          isDay={environment?.name === "day"}
          enabled={true}
          qualityLevel={settings.qualityLevel}
        />
      )}
    </>
  );
}
