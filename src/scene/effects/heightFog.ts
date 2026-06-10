/**
 * Exponential height fog (WebGL).
 *
 * three's built-in `FogExp2` is purely distance-based: every fragment at a given
 * camera distance is fogged by the same amount, regardless of how high it sits.
 * We want the *opposite* of a uniform haze — fog that pools over the streets so
 * the ground and lower floors recede into mist while tower tops stay crisp
 * (cf. the three.js `webgpu_fog_height` TSL example).
 *
 * The WebGPU example expresses this with TSL nodes; this project is WebGL, so we
 * achieve the same look by patching three's four fog `ShaderChunk`s once at
 * startup. The patch:
 *   1. carries the fragment's world-space Y from vertex → fragment (handling
 *      instancing/batching exactly like `worldpos_vertex`, since buildings are
 *      InstancedMesh), and
 *   2. multiplies the usual distance fog factor by a height attenuation that is
 *      1 at/below `fogHeightMin` and falls to 0 at/above `fogHeightMax`.
 *
 * Because the patch lives in the shared chunks, it covers *every* fog-enabled
 * material automatically — instanced buildings, embedded GLB meshes, the ground
 * plane, cars, storefronts — without touching their creation sites. Materials
 * that opt out with `fog: false` (the horizon backdrop, holographic ads) are
 * untouched, since `USE_FOG` is then undefined.
 *
 * The two height bounds are exposed as uniforms (added to `UniformsLib.fog`, so
 * every fog material clones sane defaults) and shared by reference into each
 * material via `onBeforeCompile`, which makes them live-tunable — mutating
 * `heightFogUniforms.*.value` updates the whole scene with no recompile.
 */
import { ShaderChunk, UniformsLib } from "three";
import type { Material, Object3D } from "three";

/**
 * Height-fog band (world-space Y; street level is 0, 1m ≈ 1.6u — see
 * config/scale.ts). The mist is at full `strength` at/below `MIN`, fades to
 * nothing at/above `MAX`. Tuned for the elevated rooftop spawn so the streets
 * and lower floors sink into haze while tower crowns stay clear.
 *
 * Crucially this layer is *distance-independent*: unlike plain FogExp2, a low
 * fragment is fogged even right in front of the camera, which is what makes the
 * ground actually disappear rather than just the far depth.
 */
export const DEFAULT_FOG_HEIGHT_MIN = 60;
export const DEFAULT_FOG_HEIGHT_MAX = 260;
/** Max fraction the ground mist blends toward fog color (0 = off, 1 = opaque). */
export const DEFAULT_FOG_HEIGHT_STRENGTH = 0.9;

/**
 * Shared uniform objects injected (by reference) into every fog material. Mutate
 * `.value` to retune fog height live; all materials pick it up on the next frame.
 */
export const heightFogUniforms = {
  fogHeightMin: { value: DEFAULT_FOG_HEIGHT_MIN },
  fogHeightMax: { value: DEFAULT_FOG_HEIGHT_MAX },
  fogHeightStrength: { value: DEFAULT_FOG_HEIGHT_STRENGTH },
};

let installed = false;

/**
 * Patch three's fog shader chunks and seed `UniformsLib.fog` defaults. Must run
 * before any fog material is compiled (call once at app entry). Idempotent.
 */
export function installHeightFog(): void {
  if (installed) return;
  installed = true;

  // Carry world-space Y alongside the existing view-depth varying.
  ShaderChunk.fog_pars_vertex = /* glsl */ `#ifdef USE_FOG
	varying float vFogDepth;
	varying float vFogWorldY;
#endif`;

  // Reproduce worldpos_vertex's transform chain so instanced/batched buildings
  // report their true world height (modelMatrix alone would ignore the per-
  // instance offset and collapse the whole city onto one Y).
  ShaderChunk.fog_vertex = /* glsl */ `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vec4 fogWorldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		fogWorldPosition = batchingMatrix * fogWorldPosition;
	#endif
	#ifdef USE_INSTANCING
		fogWorldPosition = instanceMatrix * fogWorldPosition;
	#endif
	fogWorldPosition = modelMatrix * fogWorldPosition;
	vFogWorldY = fogWorldPosition.y;
#endif`;

  ShaderChunk.fog_pars_fragment = /* glsl */ `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying float vFogWorldY;
	uniform float fogHeightMin;
	uniform float fogHeightMax;
	uniform float fogHeightStrength;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`;

  ShaderChunk.fog_fragment = /* glsl */ `#ifdef USE_FOG
	// 1. Ordinary distance fog (depth-based), unchanged.
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	// 2. Ground-mist layer: a distance-INDEPENDENT haze that is dense low down
	//    and gone up high, so the streets/lower floors disappear even when close
	//    while tower crowns stay crisp. fogHeightStrength caps how opaque it gets.
	float heightFog = fogHeightStrength * ( 1.0 - smoothstep( fogHeightMin, fogHeightMax, vFogWorldY ) );
	// Combine the two as independent occluders (screen/over): whichever fogs more wins.
	fogFactor = 1.0 - ( 1.0 - clamp( fogFactor, 0.0, 1.0 ) ) * ( 1.0 - clamp( heightFog, 0.0, 1.0 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

  // Defaults cloned into every fog material at compile, so materials rendered
  // before they're registered (frame 0) still show correct height fog.
  const fogUniforms = UniformsLib.fog as unknown as Record<
    string,
    { value: number }
  >;
  fogUniforms.fogHeightMin = { value: DEFAULT_FOG_HEIGHT_MIN };
  fogUniforms.fogHeightMax = { value: DEFAULT_FOG_HEIGHT_MAX };
  fogUniforms.fogHeightStrength = { value: DEFAULT_FOG_HEIGHT_STRENGTH };
}

const patched = new WeakSet<Material>();

/**
 * Wire the shared height-fog uniforms (by reference) into a single material so
 * it tracks live changes to `heightFogUniforms`. Preserves any pre-existing
 * `onBeforeCompile`. Safe to call repeatedly — only patches each material once.
 */
function registerMaterial(material: Material): void {
  if (patched.has(material) || (material as { fog?: boolean }).fog === false)
    return;
  patched.add(material);

  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    shader.uniforms.fogHeightMin = heightFogUniforms.fogHeightMin;
    shader.uniforms.fogHeightMax = heightFogUniforms.fogHeightMax;
    shader.uniforms.fogHeightStrength = heightFogUniforms.fogHeightStrength;
    if (prev) prev.call(material, shader, renderer);
  };
  // Force a recompile so onBeforeCompile runs and adopts the shared uniforms
  // even if the material was already used this frame.
  material.needsUpdate = true;
}

/**
 * Traverse a scene/subtree and register every fog material found, so subsequent
 * `heightFogUniforms` edits affect them live. Call after assets load and again
 * whenever new fog meshes are added (e.g. environment switch).
 */
export function registerSceneHeightFog(root: Object3D): void {
  root.traverse((obj) => {
    const mat = (obj as { material?: Material | Material[] }).material;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach(registerMaterial);
    else registerMaterial(mat);
  });
}

/** Live-update the fog height band; affects all registered materials next frame. */
export function setHeightFogParams(params: {
  min?: number;
  max?: number;
  strength?: number;
}): void {
  if (params.min !== undefined) heightFogUniforms.fogHeightMin.value = params.min;
  if (params.max !== undefined) heightFogUniforms.fogHeightMax.value = params.max;
  if (params.strength !== undefined)
    heightFogUniforms.fogHeightStrength.value = params.strength;
}
