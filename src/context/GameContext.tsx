import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";

import { getInitialSettings } from "../config/querySettings";
import type { GameRuntime } from "../types/game";
import type { GameSettings } from "../types/settings";
import type { TerminalApi } from "../ui/initTerminal";

type GameStore = {
  settings: GameSettings;
  setSettings: Dispatch<SetStateAction<GameSettings>>;
  quickstart: boolean;
  launchReady: boolean;
  setLaunchReady: Dispatch<SetStateAction<boolean>>;
  showBlocker: boolean;
  setShowBlocker: Dispatch<SetStateAction<boolean>>;
  showCrash: boolean;
  setShowCrash: Dispatch<SetStateAction<boolean>>;
  gameRef: MutableRefObject<GameRuntime | null>;
  terminalRef: MutableRefObject<TerminalApi | null>;
};

const GameContext = createContext<GameStore | null>(null);

// Quickstart is on by default; opt out with ?setup or ?quickstart=0
const _qsParams = new URLSearchParams(window.location.search);
const quickstart =
  !_qsParams.has("setup") && _qsParams.get("quickstart") !== "0";

export function GameProvider({ children }) {
  const [settings, setSettings] = useState(getInitialSettings);
  const [launchReady, setLaunchReady] = useState(false);
  const [showBlocker, setShowBlocker] = useState(true);
  const [showCrash, setShowCrash] = useState(false);
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
      showCrash,
      setShowCrash,
      gameRef,
      terminalRef,
    }),
    [settings, launchReady, showBlocker, showCrash],
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
