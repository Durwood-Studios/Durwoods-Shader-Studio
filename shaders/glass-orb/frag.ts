/**
 * Glass Orb — fragment shader source (v2).
 *
 * Assembled at import time by concatenating shared GLSL helpers from
 * lib/sdf/glsl.ts with the shape-specific GLSL below.
 *
 * Assembly order (one precision declaration, helpers first, then shape):
 *   PRECISION_GLSL → NOISE_GLSL → SDF_PRIMITIVES_GLSL → FRESNEL_GLSL → ENV_GLSL → SHAPE_GLSL
 */

import {
	ENV_GLSL,
	FRESNEL_GLSL,
	NOISE_GLSL,
	PRECISION_GLSL,
	SDF_PRIMITIVES_GLSL,
} from "@/lib/sdf/glsl";

// Shape-specific GLSL — no precision declaration here; PRECISION_GLSL is injected first.
const SHAPE_GLSL = /* glsl */ `
uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;

// @uniform ior:        float, range:[1.0,2.4],  default:1.50, label:"IOR",            group:"Glass",       storage:"uint8"
uniform float uIOR;
// @uniform dispersion: float, range:[0.0,0.15], default:0.03, label:"Dispersion",     group:"Glass",       storage:"uint8"
uniform float uDispersion;
// @uniform radius:     float, range:[0.15,0.95],default:0.45, label:"Radius",         group:"Glass",       storage:"uint8"
uniform float uRadius;
// @uniform wobble:     float, range:[0.0,0.5],  default:0.05, label:"Surface Wobble", group:"Glass",       storage:"uint8"
uniform float uWobble;
// @uniform roughness:  float, range:[0.0,0.3],  default:0.04, label:"Roughness",      group:"Glass",       storage:"uint8"
uniform float uRoughness;
// @uniform envHue:     float, range:[0.0,1.0],  default:0.58, label:"Env Hue",        group:"Environment", storage:"uint8"
uniform float uEnvHue;
// @uniform envBright:  float, range:[0.3,2.0],  default:1.0,  label:"Env Bright",     group:"Environment", storage:"uint8"
uniform float uEnvBright;
// @uniform floorMix:   float, range:[0.0,1.0],  default:0.35, label:"Floor Mix",      group:"Environment", storage:"uint8"
uniform float uFloorMix;

void main() {
  // Normalised device coords — [-aspect,+aspect] x [-1,+1] (short axis = 1)
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  // Mouse parallax — subtle camera shift
  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec3 ro = vec3(mouseNDC.x * 0.3, mouseNDC.y * 0.3 + 0.1, 2.6);
  vec3 rd = normalize(vec3(uv, -1.8));

  // Analytic ray-sphere intersection (centre at origin)
  float r  = uRadius * 1.5;
  float b  = dot(rd, ro);
  float c  = dot(ro, ro) - r * r;
  float disc = b * b - c;

  vec3 col;

  if (disc < 0.0) {
    // Miss — show procedural studio environment
    col = studioEnv(rd, uEnvHue, uEnvBright, uFloorMix);
  } else {
    float t   = -b - sqrt(disc);
    vec3 hit  = ro + rd * t;
    vec3 nor  = normalize(hit);

    // Optional surface wobble — noise-perturbed normal
    if (uWobble > 0.0) {
      vec3 wob = vec3(
        noise3(hit * 3.0 + vec3(uTime * 0.3,  0.0,           0.0)),
        noise3(hit * 3.0 + vec3(0.0,           uTime * 0.3,   0.0)),
        noise3(hit * 3.0 + vec3(0.0,           0.0,           uTime * 0.3))
      ) * 2.0 - 1.0;
      nor = normalize(nor + wob * uWobble);
    }

    // Schlick Fresnel (glass f0 ≈ 0.04)
    float cosTheta = max(dot(-rd, nor), 0.0);
    float F = fresnelSchlick(cosTheta, 0.04);

    // Reflection — single env sample, optionally roughened
    vec3 reflDir = reflect(rd, nor);
    if (uRoughness > 0.0) {
      vec3 jitter = vec3(
        noise3(hit * 5.0 + vec3(0.0, 0.0, 0.0)),
        noise3(hit * 5.0 + vec3(1.7, 0.0, 0.0)),
        noise3(hit * 5.0 + vec3(0.0, 3.1, 0.0))
      ) * 2.0 - 1.0;
      reflDir = normalize(reflDir + jitter * uRoughness);
    }
    vec3 refl = studioEnv(reflDir, uEnvHue, uEnvBright, uFloorMix);

    // Chromatic dispersion — three separate refraction directions, one per channel.
    // IOR offsets: R uses lower IOR (bends less), B uses higher IOR (bends more).
    vec3 refrR = refract(rd, nor, 1.0 / (uIOR - uDispersion));
    vec3 refrG = refract(rd, nor, 1.0 /  uIOR);
    vec3 refrB = refract(rd, nor, 1.0 / (uIOR + uDispersion));
    vec3 refr;
    refr.r = studioEnv(refrR, uEnvHue, uEnvBright, uFloorMix).r;
    refr.g = studioEnv(refrG, uEnvHue, uEnvBright, uFloorMix).g;
    refr.b = studioEnv(refrB, uEnvHue, uEnvBright, uFloorMix).b;

    // Fresnel blend: rim = reflection, centre = refraction
    col = mix(refr, refl, F);

    // Sharp key-light specular (GGX-style Blinn-Phong, high exponent)
    vec3  keyDir  = normalize(vec3(0.6, 0.7, 0.4));
    vec3  halfDir = normalize(keyDir - rd);
    float spec    = pow(max(dot(nor, halfDir), 0.0), 128.0);
    col += vec3(spec) * 1.6 * max(0.0, 1.0 - uRoughness * 2.0);

    // Hard silhouette mask — no soft edge needed; the disc gives a crisp border
    // because disc < 0 already took the miss path above.
  }

  // Reinhard-ish tone mapping + gamma correction
  col = col / (col + 1.0);
  col = pow(col, vec3(1.0 / 2.2));

  // Subtle vignette
  col *= 1.0 - smoothstep(0.6, 1.4, length(uv) * 0.6);

  gl_FragColor = vec4(col, 1.0);
}
`;

const fragSrc = [
	PRECISION_GLSL,
	NOISE_GLSL,
	SDF_PRIMITIVES_GLSL,
	FRESNEL_GLSL,
	ENV_GLSL,
	SHAPE_GLSL,
].join("\n");

export default fragSrc;
