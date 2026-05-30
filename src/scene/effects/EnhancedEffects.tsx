import { useMemo } from "react";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
  ToneMapping,
  BrightnessContrast,
  HueSaturation,
  SMAA,
  FXAA,
  N8AO,
  DepthOfField,
} from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction, KernelSize } from "postprocessing";
import { Vector2 } from "three";
import type { VisualPreset } from "./VisualPresets";
import { PRESET_DEFAULT } from "./VisualPresets";
import type { QualityLevel } from "../../types/settings";

type EnhancedEffectsProps = {
  preset?: VisualPreset;
  enabled?: boolean;
  isDay?: boolean;
  qualityLevel?: QualityLevel;
};

/**
 * Quality-based settings for post-processing effects
 * - low: Minimal effects for maximum performance
 * - medium: Balanced effects with optimized bloom
 * - high: Full quality effects as defined by preset
 */
const QUALITY_SETTINGS = {
  low: {
    enableBloom: false,
    enableChromaticAberration: false,
    enableColorGrading: false,
    enableVignette: false,
    enableNoise: false,
    enableAO: false,
    enableDOF: false,
    useSmaa: false, // Use faster FXAA
    bloomResolutionScale: 0.25,
    bloomKernelSize: KernelSize.VERY_SMALL,
  },
  medium: {
    enableBloom: true,
    enableChromaticAberration: false,
    enableColorGrading: false,
    enableVignette: true,
    enableNoise: false,
    enableAO: true,
    enableDOF: false,
    useSmaa: false, // Use faster FXAA
    bloomResolutionScale: 0.5,
    bloomKernelSize: KernelSize.SMALL,
  },
  high: {
    enableBloom: true,
    enableChromaticAberration: true,
    enableColorGrading: true,
    enableVignette: true,
    enableNoise: true,
    enableAO: true,
    enableDOF: true,
    useSmaa: false, // FXAA is much cheaper, SMAA rarely worth the cost
    bloomResolutionScale: 0.5, // Half resolution bloom - big GPU savings, minimal visual difference
    bloomKernelSize: KernelSize.MEDIUM, // Medium kernel - good balance of quality/performance
  },
} as const;

/**
 * Enhanced post-processing effects with preset and quality level support
 */
export function EnhancedEffects({
  preset = PRESET_DEFAULT,
  enabled = true,
  isDay = false,
  qualityLevel = "high",
}: EnhancedEffectsProps) {
  const quality = QUALITY_SETTINGS[qualityLevel];

  // Adjust bloom intensity for day/night and quality
  const bloomIntensity = useMemo(() => {
    const baseIntensity = isDay
      ? Math.max(0.35, preset.bloom.intensity * 0.05)
      : preset.bloom.intensity;
    // Reduce bloom intensity slightly on medium quality
    return qualityLevel === "medium" ? baseIntensity * 0.7 : baseIntensity;
  }, [isDay, preset.bloom.intensity, qualityLevel]);

  // Create chromatic aberration offset vector
  const chromaticOffset = useMemo(
    () =>
      new Vector2(
        preset.chromaticAberration.offset,
        preset.chromaticAberration.offset,
      ),
    [preset.chromaticAberration.offset],
  );

  if (!enabled) {
    return null;
  }

  // Low quality: minimal post-processing
  if (qualityLevel === "low") {
    return (
      <EffectComposer multisampling={0}>
        <FXAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      {/* Antialiasing - SMAA for high quality, FXAA for medium */}
      {quality.useSmaa ? <SMAA /> : <FXAA />}

      {/* Ambient Occlusion - darkens crevices and contact areas */}
      {quality.enableAO && (
        <N8AO
          aoRadius={8}
          intensity={25}
          distanceFalloff={0.5}
          halfRes={qualityLevel === "medium"}
        />
      )}

      {/* Bloom - glow effect on bright areas */}
      {quality.enableBloom && (
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={preset.bloom.luminanceThreshold}
          luminanceSmoothing={preset.bloom.luminanceSmoothing}
          mipmapBlur={true} // Always use mipmap blur for better performance
          resolutionScale={quality.bloomResolutionScale}
          kernelSize={quality.bloomKernelSize}
        />
      )}

      {/* Chromatic Aberration - color fringing at edges (high quality only) */}
      {quality.enableChromaticAberration &&
        preset.chromaticAberration.enabled && (
          <ChromaticAberration
            offset={chromaticOffset}
            radialModulation={true}
            modulationOffset={0.5}
          />
        )}

      {/* Color Grading - saturation, contrast, brightness (high quality only) */}
      {quality.enableColorGrading && preset.colorGrading.enabled && (
        <>
          <HueSaturation
            blendFunction={BlendFunction.NORMAL}
            saturation={preset.colorGrading.saturation - 1.0}
          />
          <BrightnessContrast
            brightness={preset.colorGrading.brightness}
            contrast={preset.colorGrading.contrast - 1.0}
          />
        </>
      )}

      {/* Vignette - darkened edges */}
      {quality.enableVignette && preset.vignette.enabled && (
        <Vignette
          darkness={preset.vignette.darkness}
          offset={preset.vignette.offset}
        />
      )}

      {/* Depth of Field - subtle background blur for cinematic look */}
      {quality.enableDOF && (
        <DepthOfField
          focusDistance={0.01}
          focalLength={0.05}
          bokehScale={0.6}
        />
      )}

      {/* Film Noise/Grain (high quality only) */}
      {quality.enableNoise && preset.noise.enabled && (
        <Noise
          opacity={preset.noise.opacity}
          blendFunction={BlendFunction.OVERLAY}
        />
      )}

      {/* Tone Mapping - HDR to SDR conversion */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
