import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { WebGLRenderer } from "three";

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  };
};

export type PerformanceStats = {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  jsHeapUsed: number;
  jsHeapTotal: number;
};

type PerformanceStatsCollectorProps = {
  onStats: (stats: PerformanceStats) => void;
};

/**
 * Stats collector component - must be inside R3F Canvas
 * Collects performance data and calls onStats callback
 */
export function PerformanceStatsCollector({
  onStats,
}: PerformanceStatsCollectorProps) {
  const { gl } = useThree();

  // FPS calculation
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const updateIntervalRef = useRef(0);
  const lastStatsRef = useRef({ calls: 0, triangles: 0 });

  // Disable auto-reset so we can read the actual render stats
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;

    // Track frame times for averaging
    frameTimesRef.current.push(delta);
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }

    // Capture render stats before reset (these are from the previous frame)
    const info = gl.info;
    if (info.render.calls > 0) {
      lastStatsRef.current = {
        calls: info.render.calls,
        triangles: info.render.triangles,
      };
    }

    // Reset for next frame
    gl.info.reset();

    // Update stats every ~250ms (not every frame to reduce overhead)
    updateIntervalRef.current += delta;
    if (updateIntervalRef.current < 250) {
      return;
    }
    updateIntervalRef.current = 0;

    // Calculate average FPS
    const avgFrameTime =
      frameTimesRef.current.reduce((a, b) => a + b, 0) /
      frameTimesRef.current.length;
    const fps = Math.round(1000 / avgFrameTime);

    // Get memory info (Chrome only)
    const memory = (performance as PerformanceWithMemory).memory;
    const jsHeapUsed = memory ? Math.round(memory.usedJSHeapSize / 1048576) : 0;
    const jsHeapTotal = memory
      ? Math.round(memory.totalJSHeapSize / 1048576)
      : 0;

    onStats({
      fps,
      frameTime: Math.round(avgFrameTime * 100) / 100,
      drawCalls: lastStatsRef.current.calls,
      triangles: lastStatsRef.current.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      jsHeapUsed,
      jsHeapTotal,
    });
  });

  return null; // This component doesn't render anything
}

type PerformanceMonitorProps = {
  visible?: boolean;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  stats: PerformanceStats;
};

// Orange color theme
const COLORS = {
  primary: "#ff9900",
  primaryDim: "#cc7a00",
  label: "#ffcc80",
  good: "#00ff00",
  warning: "#ffcc00",
  danger: "#ff4444",
  background: "rgba(0, 0, 0, 0.9)",
};

/**
 * Performance monitor UI component - renders outside R3F Canvas
 * Displays stats collected by PerformanceStatsCollector
 */
export function PerformanceMonitor({
  visible = true,
  position = "top-left",
  stats,
}: PerformanceMonitorProps) {
  if (!visible) {
    return null;
  }

  const positionStyle = {
    "top-left": { top: 10, left: 10 },
    "top-right": { top: 10, right: 10 },
    "bottom-left": { bottom: 10, left: 10 },
    "bottom-right": { bottom: 10, right: 10 },
  }[position];

  return (
    <div
      style={{
        position: "fixed",
        ...positionStyle,
        zIndex: 9999,
        fontFamily: "'Courier New', Consolas, monospace",
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: COLORS.background,
        color: COLORS.primary,
        padding: "10px 12px",
        borderRadius: "4px",
        border: `1px solid ${COLORS.primary}`,
        minWidth: "200px",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div style={{ marginBottom: "8px", borderBottom: `1px solid ${COLORS.primary}`, paddingBottom: "4px" }}>
        <strong>PERFORMANCE</strong>
      </div>
      <StatRow
        label="FPS"
        value={stats.fps}
        color={stats.fps >= 55 ? COLORS.good : stats.fps >= 30 ? COLORS.warning : COLORS.danger}
      />
      <StatRow label="Frame" value={`${stats.frameTime}ms`} />
      <div style={{ height: "6px" }} />
      <StatRow label="Draw Calls" value={stats.drawCalls} />
      <StatRow label="Triangles" value={formatNumber(stats.triangles)} />
      <div style={{ height: "6px" }} />
      <StatRow label="Geometries" value={stats.geometries} />
      <StatRow label="Textures" value={stats.textures} />
      <StatRow label="Shaders" value={stats.programs} />
      {stats.jsHeapUsed > 0 && (
        <>
          <div style={{ height: "6px" }} />
          <StatRow
            label="JS Heap"
            value={`${stats.jsHeapUsed}/${stats.jsHeapTotal}MB`}
            color={
              stats.jsHeapUsed / stats.jsHeapTotal > 0.9
                ? COLORS.danger
                : stats.jsHeapUsed / stats.jsHeapTotal > 0.7
                  ? COLORS.warning
                  : COLORS.good
            }
          />
        </>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  color = COLORS.primary,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
      <span style={{ color: COLORS.label }}>{label}:</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return String(num);
}

/**
 * HTML overlay version that can be used outside of R3F Canvas
 * Requires renderer to be passed as prop
 */
export function PerformanceMonitorOverlay({
  visible = true,
  position = "top-left",
  renderer,
}: PerformanceMonitorProps & { renderer?: WebGLRenderer }) {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    programs: 0,
    jsHeapUsed: 0,
    jsHeapTotal: 0,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!visible) return;

    let animationId: number;

    const update = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      const avgFrameTime =
        frameTimesRef.current.reduce((a, b) => a + b, 0) /
        frameTimesRef.current.length;
      const fps = Math.round(1000 / avgFrameTime);

      const info = renderer?.info;
      const memory = (performance as PerformanceWithMemory).memory;

      setStats({
        fps,
        frameTime: Math.round(avgFrameTime * 100) / 100,
        drawCalls: info?.render.calls ?? 0,
        triangles: info?.render.triangles ?? 0,
        geometries: info?.memory.geometries ?? 0,
        textures: info?.memory.textures ?? 0,
        programs: info?.programs?.length ?? 0,
        jsHeapUsed: memory ? Math.round(memory.usedJSHeapSize / 1048576) : 0,
        jsHeapTotal: memory ? Math.round(memory.totalJSHeapSize / 1048576) : 0,
      });

      animationId = requestAnimationFrame(update);
    };

    // Update at 4Hz instead of every frame
    const intervalId = setInterval(() => {
      update();
    }, 250);

    return () => {
      clearInterval(intervalId);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [visible, renderer]);

  if (!visible) {
    return null;
  }

  const positionStyle = {
    "top-left": { top: 10, left: 10 },
    "top-right": { top: 10, right: 10 },
    "bottom-left": { bottom: 10, left: 10 },
    "bottom-right": { bottom: 10, right: 10 },
  }[position];

  return (
    <div
      style={{
        position: "fixed",
        ...positionStyle,
        zIndex: 9999,
        fontFamily: "'Courier New', Consolas, monospace",
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: COLORS.background,
        color: COLORS.primary,
        padding: "10px 12px",
        borderRadius: "4px",
        border: `1px solid ${COLORS.primary}`,
        minWidth: "200px",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div style={{ marginBottom: "8px", borderBottom: `1px solid ${COLORS.primary}`, paddingBottom: "4px" }}>
        <strong>PERFORMANCE</strong>
      </div>
      <StatRow
        label="FPS"
        value={stats.fps}
        color={stats.fps >= 55 ? COLORS.good : stats.fps >= 30 ? COLORS.warning : COLORS.danger}
      />
      <StatRow label="Frame" value={`${stats.frameTime}ms`} />
      <div style={{ height: "6px" }} />
      <StatRow label="Draw Calls" value={stats.drawCalls} />
      <StatRow label="Triangles" value={formatNumber(stats.triangles)} />
      <div style={{ height: "6px" }} />
      <StatRow label="Geometries" value={stats.geometries} />
      <StatRow label="Textures" value={stats.textures} />
      <StatRow label="Shaders" value={stats.programs} />
      {stats.jsHeapUsed > 0 && (
        <>
          <div style={{ height: "6px" }} />
          <StatRow
            label="JS Heap"
            value={`${stats.jsHeapUsed}/${stats.jsHeapTotal}MB`}
            color={
              stats.jsHeapUsed / stats.jsHeapTotal > 0.9
                ? COLORS.danger
                : stats.jsHeapUsed / stats.jsHeapTotal > 0.7
                  ? COLORS.warning
                  : COLORS.good
            }
          />
        </>
      )}
    </div>
  );
}
