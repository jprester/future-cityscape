import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useGameStore } from "../context/GameContext";
import type {
  QualityLevel,
  FrameRateLimit,
  VisibilitySettings,
} from "../types/settings";
import { initTerminal } from "./initTerminal";
import { PRESET_NAMES, VISUAL_PRESETS } from "../scene/effects";

const curatedWorldSeeds = [9746, 6362, 4217, 5794];

const controlsText = {
  drive: [
    "use mouse to look around/steer",
    "use mouse wheel to zoom",
    "press <space> to toggle autopilot",
    "hold <w> to boost, <s> to brake",
    "use <+> and <-> to adjust volume",
    "press <]> to skip current song",
    "press <p> to pause current song",
    "press <esc> to open terminal",
  ],
  freeroam: [
    "use <w,a,s,d> to move camera",
    "use mouse wheel to zoom",
    "use <r> and <f> to adjust height",
    "hold <shift> to increase speed",
    "use <+> and <-> to adjust volume",
    "press <]> to skip current song",
    "press <p> to pause current song",
    "press <esc> to open terminal",
  ],
};

function randomCuratedSeed() {
  return curatedWorldSeeds[
    Math.floor(Math.random() * curatedWorldSeeds.length)
  ];
}

export default function UiShell() {
  const {
    settings,
    setSettings,
    quickstart,
    gameRef,
    terminalRef,
    launchReady,
    showBlocker,
    showCrash,
  } = useGameStore();
  const terminalRefLocal = useRef<HTMLDivElement | null>(null);
  const resourcesRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLSpanElement | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsLocked, setSettingsLocked] = useState(false);
  const [mode, setMode] = useState(settings.mode ?? "drive");
  const [worldSeedMode, setWorldSeedMode] = useState("curated");
  const [worldSeedValue, setWorldSeedValue] = useState(
    settings.worldSeed ?? randomCuratedSeed(),
  );
  const [renderScaling, setRenderScaling] = useState(
    String(settings.renderScaling ?? 1),
  );
  const [windshieldShader, setWindshieldShader] = useState(
    settings.windshieldShader ?? "simple",
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
  const [visibility, setVisibility] = useState<VisibilitySettings>(
    settings.visibility,
  );
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // In quickstart mode, GameBridge handles asset loading directly
    if (quickstart) {
      return () => {};
    }

    const { api, cleanup } = initTerminal({
      terminalEl: terminalRefLocal.current,
      resourcesEl: resourcesRef.current,
      controlsEl: controlsRef.current,
      cursorEl: cursorRef.current,
      onShowSettings: () => {
        setShowSettings(true);
        if (api?.updateControls) {
          api.updateControls(controlsText[mode]);
        }
      },
      onStartLoad: () => {
        if (gameRef.current && gameRef.current.load) {
          gameRef.current.load();
        }
      },
    });

    terminalRef.current = api || null;
    if (gameRef.current && gameRef.current.setTerminal) {
      gameRef.current.setTerminal(api || null);
    }

    return cleanup;
  }, []);

  // Quickstart: auto-init game once assets are loaded (pointer lock still needs user click)
  const quickstartInitDone = useRef(false);
  const [quickstartReady, setQuickstartReady] = useState(false);
  useEffect(() => {
    if (!quickstart || !launchReady || quickstartInitDone.current) return;
    quickstartInitDone.current = true;
    const game = gameRef.current;
    if (game) {
      game.onEnterClick();
      setQuickstartReady(true);
    }
  }, [quickstart, launchReady]);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, mode }));
    if (terminalRef.current?.updateControls) {
      terminalRef.current.updateControls(controlsText[mode]);
    }
  }, [mode]);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, worldSeed: worldSeedValue }));
  }, [worldSeedValue]);

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      renderScaling: parseFloat(renderScaling),
    }));
  }, [renderScaling]);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, windshieldShader }));
  }, [windshieldShader]);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, visualPreset }));
  }, [visualPreset]);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, qualityLevel }));
  }, [qualityLevel]);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, frameRateLimit }));
  }, [frameRateLimit]);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, visibility }));
  }, [visibility]);

  function handleModeChange(event: ChangeEvent<HTMLInputElement>) {
    setMode(event.target.value);
  }

  function handleWorldSeedModeChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setWorldSeedMode(value);

    if (value === "curated") {
      setWorldSeedValue(randomCuratedSeed());
    } else if (value === "random") {
      setWorldSeedValue(Math.round(Math.random() * 999999));
    }
  }

  function handleWorldSeedValueChange(event: ChangeEvent<HTMLInputElement>) {
    setWorldSeedValue(Number(event.target.value));
  }

  function handleRenderScalingChange(event: ChangeEvent<HTMLInputElement>) {
    setRenderScaling(event.target.value);
  }

  function handleWindshieldShaderChange(event: ChangeEvent<HTMLInputElement>) {
    setWindshieldShader(event.target.value);
  }

  function handleVisualPresetChange(event: ChangeEvent<HTMLInputElement>) {
    setVisualPreset(event.target.value);
  }

  function handleQualityLevelChange(event: ChangeEvent<HTMLInputElement>) {
    setQualityLevel(event.target.value as QualityLevel);
  }

  function handleFrameRateLimitChange(event: ChangeEvent<HTMLInputElement>) {
    setFrameRateLimit(Number(event.target.value) as FrameRateLimit);
  }

  function handleVisibilityChange(key: keyof VisibilitySettings) {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleEnterClick() {
    setSettingsLocked(true);
    const game = gameRef.current;
    if (game) {
      game.onEnterClick();
      if (!game.initialized) {
        return;
      }
      const target = game.canvas || document.body;
      if (target && target.requestPointerLock) {
        target.requestPointerLock();
      }
    }
  }

  // Quickstart: show minimal overlay instead of full splash
  if (quickstart) {
    function handleQuickstartClick() {
      const game = gameRef.current;
      if (!game || !game.initialized) return;
      const target = game.canvas || document.body;
      if (target && target.requestPointerLock) {
        target.requestPointerLock();
      }
    }

    return (
      <>
        <div
          id="blocker"
          className={showBlocker ? "" : "hide"}
          onClick={quickstartReady ? handleQuickstartClick : undefined}
          style={{ cursor: quickstartReady ? "pointer" : "default" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Courier New', monospace",
              color: "#00fff7",
              fontSize: "18px",
              letterSpacing: "4px",
              textShadow: "0 0 10px #00fff7, 0 0 20px #00fff7",
            }}>
            {quickstartReady ? ">> CLICK TO START <<" : ">> LOADING... <<"}
          </div>
        </div>

        <div id="crashMessage" style={{ display: showCrash ? "flex" : "none" }}>
          <div className="g1">[ You crashed ]</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div id="blocker" className={showBlocker ? "" : "hide"}>
        <div id="container">
          <div className="tCol leftCol">
            <div className="tRow" style={{ height: "100%" }}>
              <div className="tHeader">&gt;Terminal</div>
              <div id="terminal" ref={terminalRefLocal}>
                <span id="cursor" ref={cursorRef}>
                  &#9619;
                </span>
              </div>
            </div>
          </div>
          <div
            className="tCol rightCol"
            style={{ width: "calc(100% - 540px)" }}>
            <div className="tRow" style={{ height: "25%" }}>
              <div className="tHeader">#Resources</div>
              <div id="resources" ref={resourcesRef}>
                &gt;&gt; No resources queued
              </div>
            </div>
            <div className="tRow" style={{ height: "25%" }}>
              <div className="tHeader">#Settings</div>
              <div
                id="settings"
                className={settingsLocked ? "locked" : ""}
                style={{ display: showSettings ? "block" : "none" }}>
                <div
                  id="settingsLockMessage"
                  className="g1"
                  style={{
                    display: settingsLocked ? "block" : "none",
                    marginBottom: "10px",
                  }}>
                  &gt;&gt; Settings locked: refresh page to unlock
                </div>
                <div style={{ marginBottom: "5px" }}>
                  <span>Mode:</span>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsMode"
                      value="drive"
                      checked={mode === "drive"}
                      onChange={handleModeChange}
                    />
                    <span className="checkmark">[Drive]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsMode"
                      value="freeroam"
                      checked={mode === "freeroam"}
                      onChange={handleModeChange}
                    />
                    <span className="checkmark">[Freeroam]</span>
                  </label>
                </div>
                <div style={{ marginBottom: "5px" }}>
                  <span>World Seed:</span>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsWorldSeed"
                      value="curated"
                      checked={worldSeedMode === "curated"}
                      onChange={handleWorldSeedModeChange}
                    />
                    <span className="checkmark">[Curated]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsWorldSeed"
                      value="random"
                      checked={worldSeedMode === "random"}
                      onChange={handleWorldSeedModeChange}
                    />
                    <span className="checkmark">[Random]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsWorldSeed"
                      value="custom"
                      checked={worldSeedMode === "custom"}
                      onChange={handleWorldSeedModeChange}
                    />
                    <span className="checkmark">[Custom]</span>
                  </label>
                </div>
                <div
                  id="settingsWorldSeedValueContainer"
                  style={{
                    display: worldSeedMode === "custom" ? "block" : "none",
                    marginBottom: "5px",
                  }}>
                  <span>Seed:</span>
                  <input
                    type="number"
                    id="settingsWorldSeedValue"
                    name="settingsWorldSeedValue"
                    value={Number.isNaN(worldSeedValue) ? 0 : worldSeedValue}
                    onChange={handleWorldSeedValueChange}
                  />
                </div>
                <div style={{ marginBottom: "5px" }}>
                  <span>Resolution:</span>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsRenderScaling"
                      value="0.5"
                      checked={renderScaling === "0.5"}
                      onChange={handleRenderScalingChange}
                    />
                    <span className="checkmark">[0.5x]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsRenderScaling"
                      value="0.75"
                      checked={renderScaling === "0.75"}
                      onChange={handleRenderScalingChange}
                    />
                    <span className="checkmark">[0.75x]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsRenderScaling"
                      value="1"
                      checked={renderScaling === "1"}
                      onChange={handleRenderScalingChange}
                    />
                    <span className="checkmark">[1.0x]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsRenderScaling"
                      value="1.5"
                      checked={renderScaling === "1.5"}
                      onChange={handleRenderScalingChange}
                    />
                    <span className="checkmark">[1.5x]</span>
                  </label>
                </div>
                <div style={{ marginBottom: "5px" }}>
                  <span>FPS Limit:</span>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsFrameRateLimit"
                      value="30"
                      checked={frameRateLimit === 30}
                      onChange={handleFrameRateLimitChange}
                    />
                    <span className="checkmark">[30]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsFrameRateLimit"
                      value="60"
                      checked={frameRateLimit === 60}
                      onChange={handleFrameRateLimitChange}
                    />
                    <span className="checkmark">[60]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsFrameRateLimit"
                      value="120"
                      checked={frameRateLimit === 120}
                      onChange={handleFrameRateLimitChange}
                    />
                    <span className="checkmark">[120]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsFrameRateLimit"
                      value="0"
                      checked={frameRateLimit === 0}
                      onChange={handleFrameRateLimitChange}
                    />
                    <span className="checkmark">[Off]</span>
                  </label>
                </div>
                <div
                  id="settingsWindshieldShaderContainer"
                  style={{
                    marginBottom: "5px",
                    display: mode === "drive" ? "block" : "none",
                  }}>
                  <span>Windshield FX:</span>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsWindshieldShader"
                      value="simple"
                      checked={windshieldShader === "simple"}
                      onChange={handleWindshieldShaderChange}
                    />
                    <span className="checkmark">[Simple]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsWindshieldShader"
                      value="advanced"
                      checked={windshieldShader === "advanced"}
                      onChange={handleWindshieldShaderChange}
                    />
                    <span className="checkmark">[Advanced]</span>
                  </label>
                </div>
                <div style={{ marginBottom: "5px" }}>
                  <span>Quality:</span>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsQualityLevel"
                      value="low"
                      checked={qualityLevel === "low"}
                      onChange={handleQualityLevelChange}
                    />
                    <span className="checkmark">[Low]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsQualityLevel"
                      value="medium"
                      checked={qualityLevel === "medium"}
                      onChange={handleQualityLevelChange}
                    />
                    <span className="checkmark">[Medium]</span>
                  </label>
                  <label className="formCheckContainer">
                    <input
                      type="radio"
                      name="settingsQualityLevel"
                      value="high"
                      checked={qualityLevel === "high"}
                      onChange={handleQualityLevelChange}
                    />
                    <span className="checkmark">[High]</span>
                  </label>
                </div>
                <div
                  style={{
                    marginBottom: "5px",
                    display: qualityLevel !== "low" ? "block" : "none",
                  }}>
                  <span>Visual FX:</span>
                  {PRESET_NAMES.map((presetId) => (
                    <label key={presetId} className="formCheckContainer">
                      <input
                        type="radio"
                        name="settingsVisualPreset"
                        value={presetId}
                        checked={visualPreset === presetId}
                        onChange={handleVisualPresetChange}
                      />
                      <span className="checkmark">
                        [{VISUAL_PRESETS[presetId].name}]
                      </span>
                    </label>
                  ))}
                </div>
                <div style={{ marginBottom: "5px" }}>
                  <span
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => setShowDebug(!showDebug)}>
                    Debug: [{showDebug ? "-" : "+"}]
                  </span>
                </div>
                {showDebug && (
                  <div style={{ marginBottom: "5px", paddingLeft: "10px" }}>
                    <div className="g1" style={{ marginBottom: "3px" }}>
                      &gt;&gt; Object Visibility
                    </div>
                    {(
                      [
                        ["buildings", "Buildings"],
                        ["megaBuildings", "Mega Buildings"],
                        ["ads", "Ads"],
                        ["smoke", "Smoke"],
                        ["spotlights", "Spotlights"],
                        ["toppers", "Toppers"],
                        ["trafficCars", "Traffic Cars"],
                        ["playerCar", "Player Car"],
                        ["ground", "Ground"],
                        ["storefronts", "Storefronts"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="formCheckContainer"
                        style={{ display: "block" }}>
                        <input
                          type="checkbox"
                          checked={visibility[key]}
                          onChange={() => handleVisibilityChange(key)}
                        />
                        <span className="checkmark">
                          [{visibility[key] ? "x" : " "}] {label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="tRow" style={{ height: "25%" }}>
              <div className="tHeader">#Controls</div>
              <div id="controls" ref={controlsRef}>
                &gt;&gt; No program loaded
              </div>
            </div>
            <div className="tRow" style={{ height: "32px" }}>
              <button
                id="enterBtn"
                style={{ display: launchReady ? "block" : "none" }}
                onClick={handleEnterClick}>
                &gt;&gt;Launch&lt;&lt;
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="crashMessage" style={{ display: showCrash ? "flex" : "none" }}>
        <div className="g1">[ You crashed ]</div>
      </div>
    </>
  );
}
