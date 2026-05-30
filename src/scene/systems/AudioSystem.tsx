import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Audio, AudioListener, AudioLoader } from "three";
import { useGameStore } from "../../context/GameContext";
import { Radio } from "../../classes/Radio.js";
import type { GameRuntime } from "../../types/game";

export function AudioSystem() {
  const { gameRef } = useGameStore();
  const initializedRef = useRef(false);

  useFrame((state, delta) => {
    const game = gameRef.current;
    if (!game || !game.isRunning) {
      return;
    }

    if (!initializedRef.current && game.initialized) {
      initializeAudio(game);
      initializedRef.current = true;
    }

    if (game.canvasOpacity < 1 && game.canvas) {
      game.canvasOpacity += delta * 0.15;
      game.canvas.style.opacity = String(game.canvasOpacity);
      game.masterVolume += delta * 0.15;
    }

    if (game.playerController.key_plus) {
      game.userMasterVolume = Math.min(game.userMasterVolume + 0.02, 1);
    }
    if (game.playerController.key_minus) {
      game.userMasterVolume = Math.max(game.userMasterVolume - 0.02, 0);
    }

    if (game.audioListener) {
      game.audioListener.setMasterVolume(
        game.masterVolume * game.userMasterVolume,
      );
    }

    if (game.radio) {
      game.radio.update();
    }
  }, 1);

  return null;
}

function initializeAudio(game: GameRuntime) {
  if (game.audioListener) {
    return;
  }

  const audioListener = new AudioListener();
  game.audioListener = audioListener;
  game.player.camera.add(audioListener);

  const audioLoader = new AudioLoader();
  game.audioLoader = audioLoader;

  if (game.settings.music == 1) {
    game.radio = new Radio({
      audioListener: audioListener,
      controller: game.playerController,
    });
  }

  if (game.settings.soundFx == 1) {
    const soundTrafficAmbient = new Audio(audioListener);
    audioLoader.load("assets/sounds/traffic_ambient.wav", function (buffer) {
      soundTrafficAmbient.setBuffer(buffer);
      soundTrafficAmbient.setLoop(true);
      soundTrafficAmbient.setVolume(1);
      soundTrafficAmbient.play();
    });

    if (game.settings.mode == "drive") {
      const soundCarAmbient = new Audio(audioListener);
      audioLoader.load("assets/sounds/car_ambient.wav", function (buffer) {
        soundCarAmbient.setBuffer(buffer);
        soundCarAmbient.setLoop(true);
        soundCarAmbient.setVolume(1);
        soundCarAmbient.play();
      });
      const soundCarWind = new Audio(audioListener);
      audioLoader.load("assets/sounds/car_wind.wav", function (buffer) {
        soundCarWind.setBuffer(buffer);
        soundCarWind.setLoop(true);
        soundCarWind.setVolume(0);
        soundCarWind.play();
        game.player.soundWind = soundCarWind;
      });
      const soundCarStress = new Audio(audioListener);
      audioLoader.load("assets/sounds/car_stress.wav", function (buffer) {
        soundCarStress.setBuffer(buffer);
        soundCarStress.setLoop(true);
        soundCarStress.setVolume(0);
        soundCarStress.play();
        game.player.soundStress = soundCarStress;
      });
      const soundCarChimeUp = new Audio(audioListener);
      audioLoader.load("assets/sounds/chime_up.wav", function (buffer) {
        soundCarChimeUp.setBuffer(buffer);
        soundCarChimeUp.setLoop(false);
        soundCarChimeUp.setVolume(1);
        game.player.soundChimeUp = soundCarChimeUp;
      });
      const soundCarChimeDown = new Audio(audioListener);
      audioLoader.load("assets/sounds/chime_down.wav", function (buffer) {
        soundCarChimeDown.setBuffer(buffer);
        soundCarChimeDown.setLoop(false);
        soundCarChimeDown.setVolume(1);
        game.player.soundChimeDown = soundCarChimeDown;
      });
      const soundCarCrash = new Audio(audioListener);
      audioLoader.load("assets/sounds/crash.wav", function (buffer) {
        soundCarCrash.setBuffer(buffer);
        soundCarCrash.setLoop(false);
        soundCarCrash.setVolume(1);
        game.player.soundCrash = soundCarCrash;
      });
    } else {
      const soundCityAmbient = new Audio(audioListener);
      audioLoader.load("assets/sounds/city_ambient.wav", function (buffer) {
        soundCityAmbient.setBuffer(buffer);
        soundCityAmbient.setLoop(true);
        soundCityAmbient.setVolume(0);
        soundCityAmbient.play();
        game.player.soundCityAmbient = soundCityAmbient;
      });
      const soundWind = new Audio(audioListener);
      audioLoader.load("assets/sounds/car_wind.wav", function (buffer) {
        soundWind.setBuffer(buffer);
        soundWind.setLoop(true);
        soundWind.setVolume(0);
        soundWind.play();
        game.player.soundWind = soundWind;
      });
    }
  }
}
