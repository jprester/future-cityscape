import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";

import { getInitialSettings } from "../config/querySettings";
import type { GameRuntime, TerminalApi } from "../types/game";
import type { GameSettings } from "../types/settings";

type GameStore = {
  settings: GameSettings;
  setSettings: Dispatch<SetStateAction<GameSettings>>;
  quickstart: boolean;
  launchReady: boolean;
  setLaunchReady: Dispatch<SetStateAction<boolean>>;
  showBlocker: boolean;
  setShowBlocker: Dispatch<SetStateAction<boolean>>;
  gameRef: MutableRefObject<GameRuntime | null>;
  terminalRef: MutableRefObject<TerminalApi | null>;
};

const GameContext = createContext<GameStore | null>(null);

// The legacy boot terminal was removed, so asset loading is always driven by
// GameBridge (quickstart). Kept as a constant so existing consumers still work.
const quickstart = true;

export function GameProvider({ children }) {
  const [settings, setSettings] = useState(getInitialSettings);
  const [launchReady, setLaunchReady] = useState(false);
  const [showBlocker, setShowBlocker] = useState(true);
  const gameRef = useRef<GameRuntime | null>(null);
  const terminalRef = useRef<TerminalApi | null>(null);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      quickstart,
      launchReady,
      setLaunchReady,
      showBlocker,
      setShowBlocker,
      gameRef,
      terminalRef,
    }),
    [settings, launchReady, showBlocker],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameStore() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameStore must be used within GameProvider");
  }
  return context;
}
