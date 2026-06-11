import { useState } from 'react';
import UiShell from './ui/UiShell';
import SynthCityScene from './scene/systems/SynthCityScene';
import AssetViewerScene from './scene/systems/AssetViewerScene';
import AssetViewerUI from './ui/AssetViewerUI';
import { GameProvider } from './context/GameContext';
import type { ViewerCategory } from './scene/systems/assetViewerCatalog';

const isAssetViewer =
  new URLSearchParams(window.location.search).get('mode') === 'assets';

function AssetViewerApp() {
  const [category, setCategoryRaw] = useState<ViewerCategory>('buildings');
  const [viewMode, setViewMode] = useState<'single' | 'gallery'>('single');
  const [currentIndex, setCurrentIndex] = useState(0);

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
      />
      <AssetViewerUI
        category={category}
        setCategory={setCategory}
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
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
