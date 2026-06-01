import { BufferGeometry, Mesh } from "three";

import { LegacyAssetManager as AssetManager } from "../assets";
import { CITY_BLOCK_SIZE, ROAD_WIDTH, getEnvironment } from "../config";
import { Player } from "./Player.js";

import { Radio } from "./Radio.js";

import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";
import { PhysicsWorld } from "./PhysicsWorld.js";

class Game {
  constructor(options = {}) {
    this.initialized = false;
    this.options = options;
    this.settingsOverrides = options.settings ? { ...options.settings } : {};
    this.terminal = options.terminal || null;
    this.onAssetsLoaded = options.onAssetsLoaded || null;

    this.environment = getEnvironment("night");

    // query params

    const urlParams = new URLSearchParams(window.location.search);

    // When pointer lock is lost (Escape / window blur), the browser releases
    // the cursor. By default we keep the scene visible and let a click on the
    // canvas re-acquire pointer lock (see PointerLockSystem) instead of slamming
    // the full splash/terminal overlay back over the view. Opt back into the
    // old behaviour with ?uiOnUnfocus=1.
    this.uiOnUnfocus = false;
    if (urlParams.has("uiOnUnfocus"))
      this.uiOnUnfocus = urlParams.get("uiOnUnfocus") == 1 ? true : false;

    // elements

    this.canvas = options.canvas || document.getElementById("canvas");

    // fade in / volume

    this.canvasOpacity = 0;
    this.masterVolume = 0;
    this.userMasterVolume = 1;

    // world settings (from centralized config)

    this.cityBlockSize = CITY_BLOCK_SIZE;
    this.roadWidth = ROAD_WIDTH;

    // Accelerated raycasting (three-mesh-bvh) — kept for any mesh raycasts; the
    // player's collision now lives in the Rapier PhysicsWorld (see load()).
    BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
    BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    Mesh.prototype.raycast = acceleratedRaycast;
  }

  load() {
    // Kick off the Rapier physics world (async WASM load) alongside the assets.
    // The start gate waits for assets (slower), so physics is ready by gameplay;
    // anything applied earlier (spawn, rooftop colliders) is queued until ready.
    this.physics = new PhysicsWorld();
    this.physics.init().catch((e) => console.error("Physics init failed:", e));

    this.assets = new AssetManager(this, this.terminal);
    this.assets.setPath("assets/");
    this.assets.load();
  }

  onLoad() {
    // terminal
    if (this.terminal) {
      this.terminal.setColor("c2");
      this.terminal.newLine();
      this.terminal.newLine();
      this.terminal.write(">> boot sequence complete", 0, 0, null);
      this.terminal.showCredits();
    }

    if (typeof this.onAssetsLoaded === "function") {
      this.onAssetsLoaded();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    console.log("Game: Initializing");

    /*----- user settings -----*/

    // defaults
    this.settings = {
      worldSeed: 9746,
      music: true,
      soundFx: true,
      renderScaling: 1.0,
    };

    const overrides = this.settingsOverrides || {};
    if (Object.prototype.hasOwnProperty.call(overrides, "worldSeed"))
      this.settings.worldSeed = overrides.worldSeed;
    if (Object.prototype.hasOwnProperty.call(overrides, "music"))
      this.settings.music = overrides.music;
    if (Object.prototype.hasOwnProperty.call(overrides, "soundFx"))
      this.settings.soundFx = overrides.soundFx;
    if (Object.prototype.hasOwnProperty.call(overrides, "renderScaling"))
      this.settings.renderScaling = parseFloat(overrides.renderScaling);

    console.log("Game: World seed: " + this.settings.worldSeed);

    /*----- setup -----*/

    // controls

    this.playerController = this.options.controller || null;

    // create player

    if (!this.playerController) {
      throw new Error("Game requires a controller instance");
    }

    this.player = new Player({
      controller: this.playerController,
      game: this,
      camera: this.options.camera,
      x: 0,
      z: 0,
    });

    // radio

    this.radio = null;

    // post processing handled by R3F

    // generators are managed by the R3F system
    /*----- animate -----*/

    this.isRunning = true;

    /*----- event listeners -----*/

    this.pointerLockElement = this.canvas || document.body;
  }

  updatePlayer(delta) {
    this.player.update(delta);
    this.playerController.update();
  }

  setSettings(nextSettings = {}) {
    this.settingsOverrides = { ...this.settingsOverrides, ...nextSettings };
    if (this.initialized) {
      this.settings = { ...this.settings, ...nextSettings };
    }
  }

  setTerminal(terminal) {
    this.terminal = terminal;
    if (this.assets && typeof this.assets.setTerminal === "function") {
      this.assets.setTerminal(terminal);
    }
  }

  onEnterClick() {
    this.init();
  }
}

export { Game };
