import { useEffect } from "react";
import { useGameStore } from "../context/GameContext";
import {
  getViewerItems,
  VIEWER_CATEGORIES,
  type ViewerCategory,
} from "../scene/systems/assetViewerCatalog";

type AssetViewerUIProps = {
  category: ViewerCategory;
  setCategory: (category: ViewerCategory) => void;
  viewMode: "single" | "gallery";
  setViewMode: (mode: "single" | "gallery") => void;
  currentIndex: number;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
};

export default function AssetViewerUI({
  category,
  setCategory,
  viewMode,
  setViewMode,
  currentIndex,
  setCurrentIndex,
  showLabels,
  setShowLabels,
}: AssetViewerUIProps) {
  const { launchReady } = useGameStore();
  const items = getViewerItems(category);
  const total = items.length;
  const safeIndex = currentIndex % total;
  const currentItem = items[safeIndex];

  // Keyboard navigation: ←/→ cycle items, ↑/↓ cycle categories, Tab view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % total);
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + total) % total);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const i = VIEWER_CATEGORIES.findIndex((c) => c.id === category);
        const n = VIEWER_CATEGORIES.length;
        setCategory(VIEWER_CATEGORIES[(i + dir + n) % n].id);
      } else if (e.key === "Tab") {
        e.preventDefault();
        setViewMode(viewMode === "single" ? "gallery" : "single");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [total, viewMode, setViewMode, setCurrentIndex, category, setCategory]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>ASSET VIEWER</span>
        <span style={styles.hint}>
          {viewMode === "single" ? "← → cycle | " : ""}↑ ↓ category | Tab
          toggle view
        </span>
      </div>

      {/* Loading state */}
      {!launchReady && <div style={styles.loading}>Loading assets...</div>}

      {/* Controls */}
      {launchReady && (
        <div style={styles.controls}>
          {/* Category tabs */}
          <div style={styles.row}>
            {VIEWER_CATEGORIES.map((c) => (
              <button
                key={c.id}
                style={{
                  ...styles.button,
                  ...(category === c.id ? styles.buttonActive : {}),
                }}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div style={styles.row}>
            <button
              style={{
                ...styles.button,
                ...(viewMode === "single" ? styles.buttonActive : {}),
              }}
              onClick={() => setViewMode("single")}
            >
              Single
            </button>
            <button
              style={{
                ...styles.button,
                ...(viewMode === "gallery" ? styles.buttonActive : {}),
              }}
              onClick={() => setViewMode("gallery")}
            >
              Gallery
            </button>
          </div>

          {/* Single view info */}
          {viewMode === "single" && currentItem && (
            <div style={styles.info}>
              <div style={styles.row}>
                <button
                  style={styles.navButton}
                  onClick={() =>
                    setCurrentIndex((prev) => (prev - 1 + total) % total)
                  }
                >
                  ◀
                </button>
                <span style={styles.modelKey}>{currentItem.key}</span>
                <button
                  style={styles.navButton}
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % total)}
                >
                  ▶
                </button>
              </div>
              <div style={styles.meta}>
                {currentItem.detail} &middot; {safeIndex + 1}/{total}
              </div>
            </div>
          )}

          {/* Gallery info */}
          {viewMode === "gallery" && (
            <div style={styles.row}>
              <span style={styles.meta}>{total} items</span>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                />
                names
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: "16px 24px",
    fontFamily: "'Courier New', monospace",
    color: "#00fff7",
    pointerEvents: "none",
    userSelect: "none",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 4,
    textShadow: "0 0 10px #00fff7, 0 0 20px #00fff7",
  },
  hint: {
    fontSize: 12,
    opacity: 0.6,
  },
  loading: {
    fontSize: 14,
    animation: "pulse 1.5s ease-in-out infinite",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    pointerEvents: "auto",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  button: {
    background: "rgba(0, 255, 247, 0.1)",
    border: "1px solid rgba(0, 255, 247, 0.3)",
    color: "#00fff7",
    fontFamily: "'Courier New', monospace",
    fontSize: 12,
    padding: "4px 12px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  buttonActive: {
    background: "rgba(0, 255, 247, 0.25)",
    borderColor: "#00fff7",
    textShadow: "0 0 8px #00fff7",
  },
  navButton: {
    background: "rgba(0, 255, 247, 0.1)",
    border: "1px solid rgba(0, 255, 247, 0.3)",
    color: "#00fff7",
    fontFamily: "'Courier New', monospace",
    fontSize: 16,
    padding: "2px 10px",
    cursor: "pointer",
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  modelKey: {
    fontSize: 16,
    fontWeight: "bold",
    minWidth: 80,
    textAlign: "center" as const,
    textShadow: "0 0 8px #00fff7",
  },
  meta: {
    fontSize: 12,
    opacity: 0.7,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    opacity: 0.8,
    cursor: "pointer",
  },
};
