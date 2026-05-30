import { useEffect, useCallback } from "react";
import { useGameStore } from "../../context/GameContext";

export function PointerLockSystem() {
  const { gameRef, setShowBlocker } = useGameStore();

  const syncPointerLockState = useCallback(() => {
    const game = gameRef.current;
    if (!game) {
      return;
    }

    const target = game.pointerLockElement || game.canvas || document.body;
    const isLocked = document.pointerLockElement === target;

    if (!game.initialized || !game.playerController) {
      setShowBlocker(true);
      return;
    }

    game.playerController.enabled = isLocked;
    if (isLocked) {
      setShowBlocker(false);
    } else if (game.uiOnUnfocus) {
      setShowBlocker(true);
    }
  }, [gameRef, setShowBlocker]);

  const handlePointerLockChange = useCallback(() => {
    syncPointerLockState();
  }, [syncPointerLockState]);

  // Listen for pointer lock changes
  useEffect(() => {
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => {
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange,
      );
    };
  }, [handlePointerLockChange]);

  // After the player drops pointer lock (Escape / window blur), the cursor is
  // free and the scene stays visible. Clicking back on the canvas re-acquires
  // pointer lock so mouse-look resumes — without bringing back the splash.
  // Restricted to canvas clicks so it never fires while the user is interacting
  // with the splash/settings overlay (which sits above the canvas).
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const game = gameRef.current;
      if (!game || !game.initialized) {
        return;
      }
      if (event.target !== game.canvas) {
        return;
      }
      const target = game.pointerLockElement || game.canvas || document.body;
      if (document.pointerLockElement === target) {
        return;
      }
      target.requestPointerLock?.();
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [gameRef]);

  useEffect(() => {
    syncPointerLockState();
  }, [syncPointerLockState]);

  return null;
}
