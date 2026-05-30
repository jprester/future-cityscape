import { useControls, folder } from "leva";
import { EnhancedEffects } from "../effects/EnhancedEffects";
import { getPreset, PRESET_NAMES, VISUAL_PRESETS } from "../effects";
import type { QualityLevel } from "../../types/settings";

/**
 * Dev-only wrapper around <EnhancedEffects> exposing live Leva controls for the
 * visual preset and key bloom params. Gated behind import.meta.env.DEV by the
 * caller, so neither this module nor Leva ship in production. It builds a
 * modified preset object and passes it straight to EnhancedEffects — no changes
 * to the production effect component are needed.
 */
const presetOptions = PRESET_NAMES.reduce<Record<string, string>>(
  (acc, id) => {
    acc[VISUAL_PRESETS[id].name] = id;
    return acc;
  },
  {},
);

export default function DevEffects({
  isDay,
  enabled,
  qualityLevel,
  defaultPresetId,
}: {
  isDay: boolean;
  enabled: boolean;
  qualityLevel: QualityLevel;
  defaultPresetId: string;
}) {
  const base = getPreset(defaultPresetId);
  const { preset: presetId, bloomIntensity, bloomThreshold } = useControls(
    "Post-processing",
    {
      preset: { value: defaultPresetId, options: presetOptions },
      bloom: folder({
        bloomIntensity: {
          value: base.bloom.intensity,
          min: 0,
          max: 5,
          step: 0.05,
        },
        bloomThreshold: {
          value: base.bloom.luminanceThreshold,
          min: 0,
          max: 1,
          step: 0.01,
        },
      }),
    },
  );

  const selected = getPreset(presetId);
  const preset = {
    ...selected,
    bloom: {
      ...selected.bloom,
      intensity: bloomIntensity,
      luminanceThreshold: bloomThreshold,
    },
  };

  return (
    <EnhancedEffects
      preset={preset}
      isDay={isDay}
      enabled={enabled}
      qualityLevel={qualityLevel}
    />
  );
}
