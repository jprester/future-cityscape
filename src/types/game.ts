import type {
  Audio as ThreeAudio,
  AudioListener,
  AudioLoader,
  BufferGeometry,
  Material,
  Object3D,
  PerspectiveCamera,
  Texture,
} from "three";
import type { EmissiveMultipliers } from "../assets/types";
import type { AssetLoadOptions } from "../assets/AssetManager";
import type { PlayerController } from "../controllers/usePlayerController";
import type { EnvironmentConfig } from "../config/environments";
import type {
  FrameRateLimit,
  QualityLevel,
  VisibilitySettings,
} from "./settings";

/**
 * Minimal terminal contract. The legacy boot terminal was removed, so the
 * runtime now always runs with `terminal: null` (Game.js guards every call).
 * Kept as an opt-in seam in case a debug console is reintroduced.
 */
export type TerminalApi = Record<string, (...args: unknown[]) => unknown>;

export type Vector3Like = {
  x: number;
  y: number;
  z: number;
};

export type RotationLike = {
  x?: number;
  y?: number;
  z?: number;
};

export type RuntimeSettings = {
  worldSeed: number;
  music: boolean | number;
  soundFx: boolean | number;
  renderScaling: number;
  visualPreset?: string;
  qualityLevel?: QualityLevel;
  frameRateLimit?: FrameRateLimit;
  visibility?: VisibilitySettings;
};

export type RuntimeAssets = {
  getTexture: (key: string) => Texture | undefined;
  getModel: (key: string) => BufferGeometry | undefined;
  getMaterial: (key: string) => Material | Material[] | undefined;
  updateEmissiveIntensities?: (multipliers: EmissiveMultipliers) => void;
  setTerminal?: (terminal: TerminalApi | null) => void;
  loaded: boolean;
};

export type RuntimePlayer = {
  camera: PerspectiveCamera;
  body: Object3D;
  camera_target?: Object3D;
  soundWind?: ThreeAudio;
  soundCityAmbient?: ThreeAudio;
};

/**
 * Rapier-backed player collision (see classes/PhysicsWorld.js). A kinematic
 * capsule + character controller live inside; the scene registers static box
 * colliders (rooftop floor/walls/props) and sets the spawn eye position. Calls
 * made before the WASM finishes loading are queued until `ready` flips true.
 */
export type RuntimePhysics = {
  ready: boolean;
  addStaticBox: (
    id: string,
    hx: number,
    hy: number,
    hz: number,
    x: number,
    y: number,
    z: number,
  ) => void;
  addStaticTrimesh: (
    id: string,
    vertices: Float32Array,
    indices: Uint32Array,
    x: number,
    y: number,
    z: number,
  ) => void;
  removeStatic: (id: string) => void;
  setEye: (eye: Vector3Like) => void;
};

export type RuntimeRadio = {
  update: () => void;
};

export type UpdateableKind = "advert" | "smoke" | "spotlight" | "topper";

export type UpdateableVisualState = {
  isVisual: boolean;
  kind: UpdateableKind;
  modelKey: string;
  matKey?: string;
  currentMatKey?: string;
  position?: Vector3Like;
  scale?: Vector3Like;
  rotationY?: number;
  rstep?: number;
  update?: () => void;
  remove?: () => void;
};

export type TrafficCarState = {
  modelKey: string;
  pose: Object3D;
  update?: () => void;
  remove?: () => void;
};

export type WithGenId<T> = T & { __genId?: string };

export type TrafficItemState = {
  cars?: TrafficCarState[];
  update?: () => void;
  remove?: () => void;
};

type NoiseRuntime = {
  noise: (x: number, y: number, z?: number) => number;
  noiseDetail: (lod: number, falloff: number) => void;
};

export type GameRuntime = {
  initialized: boolean;
  isRunning: boolean;
  generatorsInitialized?: boolean;
  settings: RuntimeSettings;
  environment: EnvironmentConfig;
  assets?: RuntimeAssets;
  player: RuntimePlayer;
  playerController: PlayerController;
  physics?: RuntimePhysics;
  cityBlockSize: number;
  roadWidth: number;
  cityBlockNoise?: NoiseRuntime;
  cityBlockNoiseFactor?: number;
  canvas?: HTMLElement | null;
  pointerLockElement?: Element | null;
  uiOnUnfocus?: boolean;
  canvasOpacity: number;
  masterVolume: number;
  userMasterVolume: number;
  audioListener?: AudioListener;
  audioLoader?: AudioLoader;
  radio?: RuntimeRadio | null;
  onEnterClick: () => void;
  updatePlayer: (delta: number) => void;
  setSettings: (settings: Partial<RuntimeSettings>) => void;
  setTerminal?: (terminal: TerminalApi | null) => void;
  load?: (options?: AssetLoadOptions) => void;
};
