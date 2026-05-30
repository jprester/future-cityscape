import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGameStore } from "../../context/GameContext";
import type { RuntimePlayer } from "../../types/game";

/**
 * Drives the per-frame player update. Freeroam's Player is a camera controller
 * with no visual mesh, so this system renders nothing.
 */
export function PlayerSystem() {
  const { gameRef } = useGameStore();
  const playerRef = useRef<RuntimePlayer | null>(null);

  useFrame((state, delta) => {
    const game = gameRef.current;
    if (!game || !game.isRunning) {
      return;
    }

    if (game.player && game.player !== playerRef.current) {
      playerRef.current = game.player;
    }

    game.updatePlayer(delta);

    if (!game.collider.enabled) {
      game.collider.enabled = true;
    }
  }, 1);

  return null;
}
