import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls, folder } from "leva";
import { Color, type AmbientLight, type DirectionalLight, FogExp2 } from "three";
import { ENVIRONMENT_NIGHT } from "../../config/environments";
import { setHeightFogParams } from "../effects";
import { useGameStore } from "../../context/GameContext";
import type { VisibilitySettings } from "../../types/settings";

/**
 * Dev-only Leva controls for live scene tuning (lighting, environment, fog).
 *
 * Rendered inside the R3F <Canvas> and gated behind import.meta.env.DEV by the
 * caller, so neither this module nor Leva ship in production builds. Values are
 * applied directly to the scene/lights each frame, overriding the
 * environment-derived defaults from GameBridge. Defaults are seeded from
 * ENVIRONMENT_NIGHT so the panel opens matching the current look.
 */
function toHex(n: number) {
  return "#" + n.toString(16).padStart(6, "0");
}

export default function DevSceneControls() {
  const ambientRef = useRef<AmbientLight | null>(null);
  const sunRef = useRef<DirectionalLight | null>(null);
  const tmpColor = useRef(new Color());

  // Visibility toggles — drive the existing settings.visibility flags so each
  // object type can be switched off live (handy for attributing draw calls).
  const { settings, setSettings } = useGameStore();
  const setVis = (key: keyof VisibilitySettings) => (value: boolean) =>
    setSettings((s) => ({
      ...s,
      visibility: { ...s.visibility, [key]: value },
    }));

  useControls({
    Visibility: folder(
      {
        buildings: {
          value: settings.visibility.buildings,
          onChange: setVis("buildings"),
        },
        ads: { value: settings.visibility.ads, onChange: setVis("ads") },
        smoke: { value: settings.visibility.smoke, onChange: setVis("smoke") },
        spotlights: {
          value: settings.visibility.spotlights,
          onChange: setVis("spotlights"),
        },
        toppers: {
          value: settings.visibility.toppers,
          onChange: setVis("toppers"),
        },
        ground: {
          value: settings.visibility.ground,
          onChange: setVis("ground"),
        },
        storefronts: {
          value: settings.visibility.storefronts,
          onChange: setVis("storefronts"),
        },
      },
      { collapsed: true },
    ),
  });

  const values = useControls({
    Lighting: folder({
      ambientIntensity: {
        value: ENVIRONMENT_NIGHT.ambient.intensity,
        min: 0,
        max: 3,
        step: 0.01,
      },
      ambientColor: toHex(ENVIRONMENT_NIGHT.ambient.color),
      sunIntensity: {
        value: ENVIRONMENT_NIGHT.sun.intensity,
        min: 0,
        max: 5,
        step: 0.01,
      },
      sunColor: toHex(ENVIRONMENT_NIGHT.sun.color),
      sunDirection: {
        value: {
          x: ENVIRONMENT_NIGHT.sun.x,
          y: ENVIRONMENT_NIGHT.sun.y,
          z: ENVIRONMENT_NIGHT.sun.z,
        },
        step: 0.05,
      },
    }),
    Environment: folder({
      environmentIntensity: {
        value: ENVIRONMENT_NIGHT.environmentIntensity,
        min: 0,
        max: 2,
        step: 0.01,
      },
    }),
    Fog: folder({
      fogColor: toHex(ENVIRONMENT_NIGHT.fog.color),
      fogDensity: {
        value: ENVIRONMENT_NIGHT.fog.density,
        min: 0,
        max: 0.01,
        step: 0.0001,
      },
      // Height fog (scene/effects/HeightFog.ts) — street-level haze layer.
      fogGroundColor: toHex(ENVIRONMENT_NIGHT.fog.groundColor),
      fogHeightFalloff: {
        value: ENVIRONMENT_NIGHT.fog.heightFalloff,
        min: 10,
        max: 400,
        step: 1,
      },
      fogHeightBoost: {
        value: ENVIRONMENT_NIGHT.fog.heightBoost,
        min: 0,
        max: 8,
        step: 0.05,
      },
    }),
  });

  useFrame(({ scene }) => {
    // Locate the GameBridge ambient/directional lights (cache once found).
    if (!ambientRef.current) {
      ambientRef.current = scene.getObjectByProperty(
        "isAmbientLight",
        true,
      ) as AmbientLight | null;
    }
    if (!sunRef.current) {
      sunRef.current = scene.getObjectByProperty(
        "isDirectionalLight",
        true,
      ) as DirectionalLight | null;
    }

    const amb = ambientRef.current;
    if (amb) {
      amb.intensity = values.ambientIntensity;
      amb.color.set(values.ambientColor);
    }

    const sun = sunRef.current;
    if (sun) {
      sun.intensity = values.sunIntensity;
      sun.color.set(values.sunColor);
      sun.position.set(
        values.sunDirection.x,
        values.sunDirection.y,
        values.sunDirection.z,
      );
    }

    scene.environmentIntensity = values.environmentIntensity;

    if (scene.fog instanceof FogExp2) {
      scene.fog.color.copy(tmpColor.current.set(values.fogColor));
      scene.fog.density = values.fogDensity;
    }
    setHeightFogParams({
      groundColor: values.fogGroundColor,
      heightFalloff: values.fogHeightFalloff,
      heightBoost: values.fogHeightBoost,
    });
  });

  return null;
}
