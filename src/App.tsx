import { useState } from 'react';
import UiShell from './ui/UiShell';
import SynthCityScene from './scene/systems/SynthCityScene';
import AssetViewerScene from './scene/systems/AssetViewerScene';
import AssetViewerUI from './ui/AssetViewerUI';
import { GameProvider } from './context/GameContext';

const isAssetViewer =
  new URLSearchParams(window.location.search).get('mode') === 'assets';

function AssetViewerApp() {
  const [viewMode, setViewMode] = useState<'single' | 'gallery'>('single');
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <>
      <AssetViewerScene viewMode={viewMode} currentIndex={currentIndex} />
      <AssetViewerUI
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
