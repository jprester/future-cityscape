import { Color, ShaderChunk, ShaderLib, UniformsLib } from "three";

/**
 * Height fog — a global patch of three's built-in FogExp2 shader.
 *
 * Stock FogExp2 is uniform in space: a street 800 u away and a tower top 800 u
 * away get the identical fog, which is backwards for a night megacity. Real
 * haze is densest and warmest at street level (light pollution scatters off the
 * thickest air) and thins, cools and darkens with altitude. From a rooftop that
 * reads as canyons dissolving into a warm glow while tower tops stay crisp.
 *
 * Model: density multiplier  m(y) = 1 + boost · exp(-y / falloff)
 *   • y = world height (clamped at 0 = street level)
 *   • falloff = height (world units) over which the ground layer decays by 1/e
 *   • boost   = extra density at ground level, relative to the base density
 * The multiplier is integrated ANALYTICALLY along the camera→fragment ray, so
 * the result is a true average over the path (not just the fragment's height).
 * The base `scene.fog.density` is the high-altitude density; boost = 0 gives
 * exactly the stock FogExp2 result, and the far-distance culling in
 * InstancedBuildings (keyed off the base density) stays valid because the
 * patch only ever makes fog thicker.
 *
 * The fog colour blends from `scene.fog.color` toward `groundColor` by the
 * fraction of optical depth contributed by the ground layer, so distant low
 * geometry picks up the warm light-pollution tint while high geometry keeps
 * the cool sky fog.
 *
 * Plumbing: the extra uniforms are added to every ShaderLib entry that already
 * carries fog uniforms. Their values are PLAIN objects ({x,y,z,w} / {r,g,b}),
 * not Vector4/Color — three's cloneUniforms copies those by reference (it only
 * deep-clones its own math types), and WebGLUniforms uploads them by property
 * name, so one shared object drives every compiled material. That is what
 * makes live tuning (dev Leva panel) work without touching each material.
 *
 * Call installHeightFog() once BEFORE the first render (before any material
 * compiles); the chunk patch is resolved at shader compile time.
 */

export type HeightFogParams = {
  /** Fog colour at street level (sRGB hex or CSS string). */
  groundColor: number | string;
  /** Height (world units) over which the ground layer decays by 1/e. */
  heightFalloff: number;
  /** Extra density at ground level relative to the base fog density. 0 = off. */
  heightBoost: number;
};

// Shared uniform values (see plumbing note above). x = falloff, y = boost.
const fogHeightParams = { x: 90, y: 0, z: 0, w: 0 };
const fogGroundColor = { r: 0, g: 0, b: 0 };
const scratchColor = new Color();

const MARKER = "/* height-fog */";

const FOG_PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
	${MARKER}
	varying float vFogDepth;
	varying float vFogWorldY;
#endif
`;

// World Y recovered from the view-space position: world = R^T·mv + camera for
// the rigid view matrix, and (R^T·mv).y = dot(column 1 of R, mv).
const FOG_VERTEX = /* glsl */ `
#ifdef USE_FOG
	${MARKER}
	vFogDepth = - mvPosition.z;
	vFogWorldY = cameraPosition.y + dot( viewMatrix[ 1 ].xyz, mvPosition.xyz );
#endif
`;

const FOG_PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
	${MARKER}
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying float vFogWorldY;
	#ifdef FOG_EXP2
		uniform float fogDensity;
		uniform vec4 fogHeightParams; // x = falloff, y = ground boost
		uniform vec3 fogGroundColor;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
`;

const FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
	${MARKER}
	#ifdef FOG_EXP2
		// Average of exp(-y/falloff) along the ray from the camera (yA) to the
		// fragment (yB): (e^-yA - e^-yB) / (yB - yA), with the y ≈ const limit.
		float yA = max( cameraPosition.y, 0.0 ) / fogHeightParams.x;
		float yB = max( vFogWorldY, 0.0 ) / fogHeightParams.x;
		float dy = yB - yA;
		float avgExp = abs( dy ) > 1e-3 ? ( exp( -yA ) - exp( -yB ) ) / dy : exp( -yA );
		float groundTerm = fogHeightParams.y * avgExp;
		float heightTerm = 1.0 + groundTerm;
		float fogTau = fogDensity * vFogDepth * heightTerm;
		float fogFactor = 1.0 - exp( - fogTau * fogTau );
		vec3 fogColorAtDepth = mix( fogColor, fogGroundColor, groundTerm / heightTerm );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		vec3 fogColorAtDepth = fogColor;
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColorAtDepth, fogFactor );
#endif
`;

/**
 * Patch three's fog shader chunks and register the extra uniforms. Idempotent
 * (safe under HMR), and a no-op visual change until heightBoost > 0.
 */
export function installHeightFog(): void {
  if (!ShaderChunk.fog_fragment.includes(MARKER)) {
    const chunk = ShaderChunk as unknown as Record<string, string>;
    chunk.fog_pars_vertex = FOG_PARS_VERTEX;
    chunk.fog_vertex = FOG_VERTEX;
    chunk.fog_pars_fragment = FOG_PARS_FRAGMENT;
    chunk.fog_fragment = FOG_FRAGMENT;
  }

  const extra = {
    fogHeightParams: { value: fogHeightParams },
    fogGroundColor: { value: fogGroundColor },
  };
  const fogLib = UniformsLib.fog as unknown as Record<string, unknown>;
  Object.assign(fogLib, extra);
  // ShaderLib entries merged UniformsLib.fog at import time, so patch each one
  // that carries fog uniforms; materials clone these on program creation.
  for (const entry of Object.values(ShaderLib)) {
    const uniforms = (entry as { uniforms?: Record<string, unknown> })
      .uniforms;
    if (uniforms && "fogColor" in uniforms) Object.assign(uniforms, extra);
  }
}

/** Update the live height-fog parameters (applies to every fogged material). */
export function setHeightFogParams(params: HeightFogParams): void {
  fogHeightParams.x = Math.max(1, params.heightFalloff);
  fogHeightParams.y = Math.max(0, params.heightBoost);
  // Color.set() converts sRGB input to the linear working space, matching how
  // the renderer feeds scene.fog.color into `fogColor`.
  scratchColor.set(params.groundColor);
  fogGroundColor.r = scratchColor.r;
  fogGroundColor.g = scratchColor.g;
  fogGroundColor.b = scratchColor.b;
}
