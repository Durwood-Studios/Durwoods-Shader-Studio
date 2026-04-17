/**
 * Gyroid — fragment shader source (v1).
 *
 * Raymarches a Triply Periodic Minimal Surface (TPMS): morphs between the
 * Gyroid and Schwarz-P surfaces, bounded by a sphere of radius 1.5.
 * Assembly order:
 *   PRECISION_GLSL → NOISE_GLSL → SDF_PRIMITIVES_GLSL → FRESNEL_GLSL → ENV_GLSL → SHAPE_GLSL
 */

import {
	ENV_GLSL,
	FRESNEL_GLSL,
	NOISE_GLSL,
	PRECISION_GLSL,
	SDF_PRIMITIVES_GLSL,
} from "@/lib/sdf/glsl";

const SHAPE_GLSL = /* glsl */ `
uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;

// @uniform scale:     float, range:[1.0,10.0], default:4.0,  label:"Scale",     group:"Surface",     storage:"uint8"
uniform float uScale;
// @uniform thickness: float, range:[0.01,0.3], default:0.05, label:"Thickness", group:"Surface",     storage:"uint8"
uniform float uThickness;
// @uniform morph:     float, range:[0.0,1.0],  default:0.5,  label:"Morph",     group:"Surface",     storage:"uint8"
uniform float uMorph;
// @uniform metallic:  float, range:[0.0,1.0],  default:0.7,  label:"Metallic",  group:"Material",    storage:"uint8"
uniform float uMetallic;
// @uniform envHue:    float, range:[0.0,1.0],  default:0.58, label:"Env Hue",   group:"Environment", storage:"uint8"
uniform float uEnvHue;
// @uniform envBright: float, range:[0.3,2.0],  default:1.0,  label:"Env Bright",group:"Environment", storage:"uint8"
uniform float uEnvBright;
// @uniform floorMix:  float, range:[0.0,1.0],  default:0.35, label:"Floor Mix", group:"Environment", storage:"uint8"
uniform float uFloorMix;

// Gyroid implicit: |sin(x)cos(y) + sin(y)cos(z) + sin(z)cos(x)| - thickness
float gyroidSDF(vec3 p) {
  return abs(dot(sin(p), cos(p.yzx))) - uThickness;
}

// Schwarz P: |cos(x)+cos(y)+cos(z)| - thickness
float schwarzP(vec3 p) {
  return abs(cos(p.x) + cos(p.y) + cos(p.z)) - uThickness;
}

// Blended TPMS, divided by scale to keep world-space distances valid
float tpms(vec3 p) {
  vec3 sp = p * uScale;
  return mix(gyroidSDF(sp), schwarzP(sp), uMorph) / max(uScale, 1.0);
}

// Scene: TPMS clipped by a bounding sphere of radius 1.5
float sceneSDF(vec3 p) {
  float sphere = sdSphere(p, 1.5);
  float surface = tpms(p);
  return max(surface, sphere);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
    sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
    sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
  ));
}

// Slow rotation matrix around Y axis
mat3 rotMatY(float a) {
  float c = cos(a); float s = sin(a);
  return mat3(c, 0.0, s,  0.0, 1.0, 0.0,  -s, 0.0, c);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  // Fixed camera position, slightly elevated
  vec3 ro = vec3(mouseNDC.x * 0.4, 0.3 + mouseNDC.y * 0.3, 3.2);
  vec3 rd = normalize(vec3(uv, -2.0));

  // Rotate ray around Y for time-driven spin
  mat3 rot = rotMatY(uTime * 0.15);
  rd = rot * rd;
  ro = rot * ro;

  // Raymarching — TPMS can have very small features, use tight epsilon
  float t = 0.5;
  bool hit = false;
  vec3 pos = ro;
  for (int i = 0; i < 80; i++) {
    pos = ro + rd * t;
    float d = sceneSDF(pos);
    if (d < 0.001) { hit = true; break; }
    if (t > 6.0) break;
    t += max(d, 0.005); // clamp minimum step to avoid infinite loops in near-zero DE
  }

  vec3 col;
  if (!hit) {
    col = studioEnv(rd, uEnvHue, uEnvBright, uFloorMix);
  } else {
    vec3 nor = calcNormal(pos);
    vec3 reflDir = reflect(rd, nor);
    vec3 refrDir = refract(rd, nor, 1.0 / 1.4);

    float cosTheta = max(dot(-rd, nor), 0.0);
    // Metallic uses higher F0 (gold-like ~0.6)
    float f0 = mix(0.04, 0.6, uMetallic);
    float F  = fresnelSchlick(cosTheta, f0);

    vec3 refl = studioEnv(reflDir, uEnvHue, uEnvBright, uFloorMix);
    vec3 refr = (refrDir == vec3(0.0))
      ? refl
      : studioEnv(refrDir, uEnvHue, uEnvBright, uFloorMix);

    // Metallic tint — gold/copper hue on the reflected component
    vec3 metalTint = mix(vec3(1.0), vec3(1.0, 0.85, 0.55), uMetallic);
    refl *= metalTint;

    // Blend reflection and refraction by Fresnel; metallic suppresses refraction
    col = mix(mix(refr, refl, F), refl, uMetallic);

    // Specular highlight
    vec3 keyDir  = normalize(vec3(0.6, 0.7, 0.4));
    vec3 halfDir = normalize(keyDir - rd);
    float spec   = pow(max(dot(nor, halfDir), 0.0), 96.0);
    col += vec3(1.0, 0.95, 0.85) * spec * mix(0.6, 2.0, uMetallic);

    // Thin AO from DE evaluation one step above surface
    float ao = clamp(sceneSDF(pos + nor * 0.05) / 0.05, 0.0, 1.0);
    col *= 0.35 + 0.65 * ao;
  }

  col = col / (col + 1.0);
  col = pow(col, vec3(1.0 / 2.2));
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
