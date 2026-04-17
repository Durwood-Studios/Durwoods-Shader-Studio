/**
 * Julia 3D — fragment shader source (v1).
 *
 * Raymarches a quaternion Julia set using the standard DE derived from
 * tracking the quaternion derivative through iteration: q → q² + c.
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

// @uniform cx:         float, range:[-1.0,1.0], default:0.4,  label:"C.x",       group:"Quaternion",  storage:"uint8"
uniform float uCx;
// @uniform cy:         float, range:[-1.0,1.0], default:-0.2, label:"C.y",       group:"Quaternion",  storage:"uint8"
uniform float uCy;
// @uniform cz:         float, range:[-1.0,1.0], default:0.1,  label:"C.z",       group:"Quaternion",  storage:"uint8"
uniform float uCz;
// @uniform cw:         float, range:[-1.0,1.0], default:-0.3, label:"C.w",       group:"Quaternion",  storage:"uint8"
uniform float uCw;
// @uniform iterations: float, range:[2.0,12.0], default:8.0,  label:"Iterations",group:"Quaternion",  storage:"uint8"
uniform float uIterations;
// @uniform colorShift: float, range:[0.0,1.0],  default:0.0,  label:"Color Shift",group:"Material",   storage:"uint8"
uniform float uColorShift;
// @uniform envHue:     float, range:[0.0,1.0],  default:0.58, label:"Env Hue",   group:"Environment", storage:"uint8"
uniform float uEnvHue;
// @uniform envBright:  float, range:[0.3,2.0],  default:1.0,  label:"Env Bright",group:"Environment", storage:"uint8"
uniform float uEnvBright;
// @uniform floorMix:   float, range:[0.0,1.0],  default:0.35, label:"Floor Mix", group:"Environment", storage:"uint8"
uniform float uFloorMix;

// Quaternion multiplication: (a0+a1i+a2j+a3k)*(b0+b1i+b2j+b3k)
vec4 qmul(vec4 a, vec4 b) {
  return vec4(
    a.x*b.x - a.y*b.y - a.z*b.z - a.w*b.w,
    a.x*b.y + a.y*b.x + a.z*b.w - a.w*b.z,
    a.x*b.z - a.y*b.w + a.z*b.x + a.w*b.y,
    a.x*b.w + a.y*b.z - a.z*b.y + a.w*b.x
  );
}

// Quaternion Julia DE.
// The 3D point p is lifted to a quaternion (0, p.x, p.y, p.z) with real=0.
// c = (uCx, uCy, uCz, uCw)
// Derivative tracked via chain rule: dq/dp = 2*q*dq (scalar factor from chain rule).
float juliaDE(vec3 p) {
  vec4 q  = vec4(0.0, p.x, p.y, p.z);
  vec4 c  = vec4(uCx, uCy, uCz, uCw);
  vec4 dq = vec4(1.0, 0.0, 0.0, 0.0); // derivative seed

  for (int i = 0; i < 12; i++) {
    if (float(i) >= uIterations) break;
    dq = 2.0 * qmul(q, dq);
    q  = qmul(q, q) + c;
    if (dot(q, q) > 64.0) break;
  }

  float r  = length(q);
  float dr = length(dq);
  // Guard against degenerate dr
  if (dr < 1e-6) return 0.0;
  return 0.5 * r * log(r) / dr;
}

// Orbit-trap colour: track min distance to origin over the iteration
vec3 juliaOrbitColor(vec3 p) {
  vec4 q = vec4(0.0, p.x, p.y, p.z);
  vec4 c = vec4(uCx, uCy, uCz, uCw);
  float minR = 1e9;
  float minI = 0.0;
  for (int i = 0; i < 12; i++) {
    if (float(i) >= uIterations) break;
    q = qmul(q, q) + c;
    float r = length(q);
    if (r < minR) { minR = r; minI = float(i); }
    if (r > 8.0) break;
  }
  float t = fract(minR * 0.5 + uColorShift + minI * 0.07);
  // HSV-like colour wheel from orbit-trap value
  vec3 col;
  col.r = clamp(abs(t * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  col.g = clamp(2.0 - abs(t * 6.0 - 2.0), 0.0, 1.0);
  col.b = clamp(2.0 - abs(t * 6.0 - 4.0), 0.0, 1.0);
  return col;
}

// Central-difference normal
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    juliaDE(p + e.xyy) - juliaDE(p - e.xyy),
    juliaDE(p + e.yxy) - juliaDE(p - e.yxy),
    juliaDE(p + e.yyx) - juliaDE(p - e.yyx)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  // Orbiting camera
  float angle = uTime * 0.08 + mouseNDC.x * 0.7;
  float pitch = 0.25 + mouseNDC.y * 0.25;
  vec3 ro = vec3(sin(angle)*cos(pitch), sin(pitch), cos(angle)*cos(pitch)) * 2.4;
  vec3 fwd = normalize(-ro);
  vec3 right2 = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up2 = cross(fwd, right2);
  vec3 rd = normalize(uv.x * right2 + uv.y * up2 + 1.7 * fwd);

  // Raymarch — conservative step factor 0.5 for Julia set
  float t = 0.0;
  bool hit = false;
  vec3 pos = ro;
  for (int i = 0; i < 80; i++) {
    pos = ro + rd * t;
    float d = juliaDE(pos);
    if (d < 0.001) { hit = true; break; }
    if (t > 6.0) break;
    t += d * 0.5;
  }

  vec3 col;
  if (!hit) {
    col = studioEnv(rd, uEnvHue, uEnvBright, uFloorMix);
  } else {
    vec3 nor = calcNormal(pos);
    vec3 reflDir = reflect(rd, nor);

    // Fresnel
    float cosTheta = max(dot(-rd, nor), 0.0);
    float F = fresnelSchlick(cosTheta, 0.04);

    vec3 envRefl = studioEnv(reflDir, uEnvHue, uEnvBright, uFloorMix);

    // Orbit trap colour provides the fractal colouring layer
    vec3 orb = juliaOrbitColor(pos);

    // Refraction-like pass (single IOR sample, no dispersion)
    vec3 refrDir = refract(rd, nor, 1.0 / 1.5);
    vec3 refr = (refrDir == vec3(0.0))
      ? envRefl
      : studioEnv(refrDir, uEnvHue, uEnvBright, uFloorMix);

    // Base: blend orbit trap with refraction, then add fresnel reflection
    vec3 base = mix(refr, orb, 0.55);
    col = mix(base, envRefl, F * 0.5);

    // Specular
    vec3 keyDir  = normalize(vec3(0.6, 0.7, 0.4));
    vec3 halfDir = normalize(keyDir - rd);
    float spec   = pow(max(dot(nor, halfDir), 0.0), 80.0);
    col += vec3(1.0, 0.95, 0.85) * spec * 1.0;

    // AO from DE
    float ao = clamp(juliaDE(pos + nor * 0.07) / 0.07, 0.0, 1.0);
    col *= 0.25 + 0.75 * ao;
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
