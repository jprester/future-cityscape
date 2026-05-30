import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { AudioSystem } from "./AudioSystem";
import { GameBridge } from "./GameBridge";
import { FiniteCitySystem } from "./FiniteCitySystem";
import { PlayerSystem } from "./PlayerSystem";
import { PointerLockSystem } from "./PointerLockSystem";
import { useGameStore } from "../../context/GameContext";
import {
  PerformanceMonitor,
  PerformanceStatsCollector,
  type PerformanceStats,
} from "../../ui/PerformanceMonitor";

/**
 * Frame rate limiter using demand-based rendering with timed invalidation
 * When frameRateLimit > 0, we use frameloop="demand" and manually trigger
 * renders at the target interval
 */
function FrameLimiter() {
  const { settings } = useGameStore();
  const { invalidate } = useThree();
  const rafId = useRef<number>(0);
  const lastTime = useRef<number>(0);

  useEffect(() => {
    if (settings.frameRateLimit === 0) {
      return;
    }

    const frameInterval = 1000 / settings.frameRateLimit;

    const tick = (time: number) => {
      const delta = time - lastTime.current;

      if (delta >= frameInterval) {
        lastTime.current = time - (delta % frameInterval);
        invalidate();
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [settings.frameRateLimit, invalidate]);

  return null;
}

function SceneContent({
  showPerfMonitor,
  onStats,
}: {
  showPerfMonitor: boolean;
  onStats: (stats: PerformanceStats) => void;
}) {
  return (
    <>
      <FrameLimiter />
      <GameBridge />
      <FiniteCitySystem />
      <PlayerSystem />
      <AudioSystem />
      <PointerLockSystem />
      {showPerfMonitor && <PerformanceStatsCollector onStats={onStats} />}
    </>
  );
}

const defaultStats: PerformanceStats = {
  fps: 0,
  frameTime: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  jsHeapUsed: 0,
  jsHeapTotal: 0,
};

export default function SynthCityScene() {
  const { settings } = useGameStore();
  const [showPerfMonitor, setShowPerfMonitor] = useState(false);
  const [perfStats, setPerfStats] = useState<PerformanceStats>(defaultStats);

  // Toggle performance monitor with backtick key (`)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "`" || e.key === "F3") {
        e.preventDefault();
        setShowPerfMonitor((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Canvas
        style={{ position: "fixed", inset: 0, zIndex: 0 }}
        frameloop={settings.frameRateLimit > 0 ? "demand" : "always"}
      >
        <SceneContent showPerfMonitor={showPerfMonitor} onStats={setPerfStats} />
      </Canvas>
      <PerformanceMonitor
        visible={showPerfMonitor}
        position="top-right"
        stats={perfStats}
      />
    </>
  );
}
