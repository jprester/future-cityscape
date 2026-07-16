import { useEffect, useState } from 'react';
import UiShell from './ui/UiShell';
import SynthCityScene from './scene/systems/SynthCityScene';
import AssetViewerScene from './scene/systems/AssetViewerScene';
import AssetViewerUI from './ui/AssetViewerUI';
import { GameProvider } from './context/GameContext';
import {
  getViewerItems,
  VIEWER_CATEGORIES,
  type ViewerCategory,
} from './scene/systems/assetViewerCatalog';

const isAssetViewer =
  new URLSearchParams(window.location.search).get('mode') === 'assets';

function getInitialAssetViewerSelection(): {
  category: ViewerCategory;
  index: number;
} {
  const requestedKey = new URLSearchParams(window.location.search).get('asset');
  if (requestedKey) {
    for (const { id } of VIEWER_CATEGORIES) {
      const index = getViewerItems(id).findIndex(
        (item) => item.key === requestedKey,
      );
      if (index >= 0) return { category: id, index };
    }
  }
  return { category: 'buildings', index: 0 };
}

function AssetViewerApp() {
  const [initialSelection] = useState(getInitialAssetViewerSelection);
  const [category, setCategoryRaw] = useState<ViewerCategory>(
    initialSelection.category,
  );
  const [viewMode, setViewMode] = useState<'single' | 'gallery'>('single');
  const [currentIndex, setCurrentIndex] = useState(initialSelection.index);
  const [showLabels, setShowLabels] = useState(true);

  // Keep the selected item shareable as the user cycles through the viewer.
  useEffect(() => {
    const items = getViewerItems(category);
    const current = items[currentIndex % items.length];
    if (!current) return;
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'assets');
    url.searchParams.set('asset', current.key);
    window.history.replaceState(null, '', url);
  }, [category, currentIndex]);

  // Each category has its own item count, so restart from the first item.
  const setCategory = (c: ViewerCategory) => {
    setCategoryRaw(c);
    setCurrentIndex(0);
  };

  return (
    <>
      <AssetViewerScene
        category={category}
        viewMode={viewMode}
        currentIndex={currentIndex}
        showLabels={showLabels}
      />
      <AssetViewerUI
        category={category}
        setCategory={setCategory}
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
      />
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      {isAssetViewer ? (
        <AssetViewerApp />
      ) : (
        <>
          <SynthCityScene />
          <UiShell />
        </>
      )}
    </GameProvider>
  );
}
