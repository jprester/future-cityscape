import { useEffect, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { useGameStore } from "../context/GameContext";
import type { QualityLevel, FrameRateLimit } from "../types/settings";
import { PRESET_NAMES, VISUAL_PRESETS } from "../scene/effects";

const curatedWorldSeeds = [9746, 6362, 4217, 5794];

function randomCuratedSeed() {
  return curatedWorldSeeds[
    Math.floor(Math.random() * curatedWorldSeeds.length)
  ];
}

/**
 * Minimal, neutral app shell:
 *   - a start / pause overlay (shown whenever the pointer is unlocked), with
 *   - a collapsible settings panel using default-styled form controls.
 * Replaces the old SynthCity boot-terminal splash. Pointer-lock state (and thus
 * overlay visibility) is owned by PointerLockSystem via `showBlocker`.
 */
export default function UiShell() {
  const { settings, setSettings, gameRef, launchReady, showBlocker } =
    useGameStore();

  const [showSettings, setShowSettings] = useState(false);
  const [started, setStarted] = useState(false);

  const [worldSeedMode, setWorldSeedMode] = useState("curated");
  const [worldSeedValue, setWorldSeedValue] = useState(
    settings.worldSeed ?? randomCuratedSeed(),
  );
  const [renderScaling, setRenderScaling] = useState(
    String(settings.renderScaling ?? 1),
  );
  const [visualPreset, setVisualPreset] = useState(
    settings.visualPreset ?? "default",
  );
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>(
    settings.qualityLevel ?? "high",
  );
  const [frameRateLimit, setFrameRateLimit] = useState<FrameRateLimit>(
    settings.frameRateLimit ?? 0,
  );

  // Settings-first: we do NOT auto-initialize when assets finish loading.
  // Assets load in the background (GameBridge), the user picks settings on this
  // overlay, and the game only initializes on "Start" (handleStart) — so mode
  // and the rest are read with the chosen values.

  // Propagate local control state to the shared settings store.
  useEffect(() => {
    setSettings((prev) => ({ ...prev, worldSeed: worldSeedValue }));
  }, [worldSeedValue, setSettings]);
  useEffect(() => {
    setSettings((prev) => ({ ...prev, renderScaling: parseFloat(renderScaling) }));
  }, [renderScaling, setSettings]);
  useEffect(() => {
    setSettings((prev) => ({ ...prev, visualPreset }));
  }, [visualPreset, setSettings]);
  useEffect(() => {
    setSettings((prev) => ({ ...prev, qualityLevel }));
  }, [qualityLevel, setSettings]);
  useEffect(() => {
    setSettings((prev) => ({ ...prev, frameRateLimit }));
  }, [frameRateLimit, setSettings]);

  function handleWorldSeedModeChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setWorldSeedMode(value);
    if (value === "curated") setWorldSeedValue(randomCuratedSeed());
    else if (value === "random")
      setWorldSeedValue(Math.round(Math.random() * 999999));
  }

  function handleStart() {
    const game = gameRef.current;
    if (!game) return;
    if (!game.initialized && game.onEnterClick) game.onEnterClick();
    if (!game.initialized) return;
    const target = game.canvas || document.body;
    target?.requestPointerLock?.();
    setStarted(true);
  }

  const primaryLabel = !launchReady
    ? "Loading…"
    : started
      ? "Resume"
      : "Click to start";

  return (
    <>
      {showBlocker && (
        <div style={styles.overlay}>
          <div style={styles.card}>
            <div style={styles.title}>Future Cityscape</div>

            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(launchReady ? {} : styles.primaryButtonDisabled),
              }}
              disabled={!launchReady}
              onClick={handleStart}
            >
              {primaryLabel}
            </button>

            <button
              type="button"
              style={styles.linkButton}
              onClick={() => setShowSettings((v) => !v)}
            >
              {showSettings ? "Hide settings" : "Settings"}
            </button>

            {showSettings && (
              <div style={styles.panel}>
                <Field label="World seed">
                  <select
                    style={styles.select}
                    value={worldSeedMode}
                    onChange={handleWorldSeedModeChange}
                  >
                    <option value="curated">Curated</option>
                    <option value="random">Random</option>
                    <option value="custom">Custom</option>
                  </select>
                </Field>

                {worldSeedMode === "custom" && (
                  <Field label="Seed">
                    <input
                      type="number"
                      style={styles.select}
                      value={Number.isNaN(worldSeedValue) ? 0 : worldSeedValue}
                      onChange={(e) => setWorldSeedValue(Number(e.target.value))}
                    />
                  </Field>
                )}

                <Field label="Quality">
                  <select
                    style={styles.select}
                    value={qualityLevel}
                    onChange={(e) =>
                      setQualityLevel(e.target.value as QualityLevel)
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>

                {qualityLevel !== "low" && (
                  <Field label="Visual FX">
                    <select
                      style={styles.select}
                      value={visualPreset}
                      onChange={(e) => setVisualPreset(e.target.value)}
                    >
                      {PRESET_NAMES.map((presetId) => (
                        <option key={presetId} value={presetId}>
                          {VISUAL_PRESETS[presetId].name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Resolution">
                  <select
                    style={styles.select}
                    value={renderScaling}
                    onChange={(e) => setRenderScaling(e.target.value)}
                  >
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1.0x</option>
                    <option value="1.5">1.5x</option>
                  </select>
                </Field>

                <Field label="FPS limit">
                  <select
                    style={styles.select}
                    value={String(frameRateLimit)}
                    onChange={(e) =>
                      setFrameRateLimit(Number(e.target.value) as FrameRateLimit)
                    }
                  >
                    <option value="30">30</option>
                    <option value="60">60</option>
                    <option value="120">120</option>
                    <option value="0">Unlimited</option>
                  </select>
                </Field>

                <div style={styles.hint}>World seed updates live.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.55)",
    backdropFilter: "blur(6px)",
  },
  card: {
    minWidth: 280,
    maxWidth: 360,
    padding: "28px 24px",
    borderRadius: 12,
    background: "var(--ui-bg)",
    border: "1px solid var(--ui-border)",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    textAlign: "center",
    marginBottom: 4,
  },
  primaryButton: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "var(--ui-accent)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  primaryButtonDisabled: {
    background: "rgba(255, 255, 255, 0.12)",
    color: "var(--ui-text-dim)",
    cursor: "default",
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "var(--ui-text-dim)",
    fontSize: 13,
    cursor: "pointer",
    padding: 4,
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 4,
    paddingTop: 12,
    borderTop: "1px solid var(--ui-border)",
  },
  field: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldLabel: {
    color: "var(--ui-text-dim)",
    fontSize: 13,
  },
  select: {
    background: "rgba(0, 0, 0, 0.35)",
    color: "var(--ui-text)",
    border: "1px solid var(--ui-border)",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 13,
    minWidth: 110,
  },
  hint: {
    color: "var(--ui-text-dim)",
    fontSize: 11,
    marginTop: 4,
  },
};
