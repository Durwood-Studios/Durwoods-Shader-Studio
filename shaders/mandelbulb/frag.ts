/**
 * Mandelbulb — fragment shader source (v1).
 *
 * Raymarches the degree-N Mandelbulb fractal distance estimator.
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

// @uniform power:       float, range:[2.0,12.0], default:8.0,  label:"Power",        group:"Fractal",     storage:"uint8"
uniform float uPower;
// @uniform iterations:  float, range:[2.0,12.0], default:6.0,  label:"Iterations",   group:"Fractal",     storage:"uint8"
uniform float uIterations;
// @uniform bail:        float, range:[1.0,8.0],  default:2.0,  label:"Bailout",      group:"Fractal",     storage:"uint8"
uniform float uBail;
// @uniform colorMix:    float, range:[0.0,1.0],  default:0.5,  label:"Color Mix",    group:"Fractal",     storage:"uint8"
uniform float uColorMix;
// @uniform rotateY:     float, range:[0.0,6.28], default:0.0,  label:"Rotate Y",     group:"Fractal",     storage:"uint8"
uniform float uRotateY;
// @uniform envHue:      float, range:[0.0,1.0],  default:0.58, label:"Env Hue",      group:"Environment", storage:"uint8"
uniform float uEnvHue;
// @uniform envBright:   float, range:[0.3,2.0],  default:1.0,  label:"Env Bright",   group:"Environment", storage:"uint8"
uniform float uEnvBright;
// @uniform floorMix:    float, range:[0.0,1.0],  default:0.35, label:"Floor Mix",    group:"Environment", storage:"uint8"
uniform float uFloorMix;

// Rotate around Y axis
vec3 rotY(vec3 p, float a) {
  float c = cos(a); float s = sin(a);
  return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

// Mandelbulb distance estimator (degree uPower, WebGL 1 — fixed upper bound)
float mandelbulbDE(vec3 p) {
  vec3  z  = p;
  float dr = 1.0;
  float r  = 0.0;
  for (int i = 0; i < 12; i++) {
    if (float(i) >= uIterations) break;
    r = length(z);
    if (r > uBail) break;
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi   = atan(z.y, z.x);
    dr  = pow(r, uPower - 1.0) * uPower * dr + 1.0;
    float zr = pow(r, uPower);
    theta *= uPower;
    phi   *= uPower;
    z  = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
    z += p;
  }
  return 0.5 * log(r) * r / dr;
}

// Orbit-trap colour — accumulate min distance to coordinate axes during march
vec3 orbitColor(vec3 p) {
  vec3  z    = p;
  float trap = 1e9;
  for (int i = 0; i < 12; i++) {
    if (float(i) >= uIterations) break;
    float r = length(z);
    if (r > uBail) break;
    // Trap: distance to XY plane and YZ plane
    trap = min(trap, abs(z.z));
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi   = atan(z.y, z.x);
    float dr    = pow(r, uPower - 1.0) * uPower + 1.0;
    float zr    = pow(r, uPower);
    theta *= uPower;
    phi   *= uPower;
    z = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
    z += p;
  }
  // Map trap to a colour band
  float t = clamp(trap * 1.5, 0.0, 1.0);
  return mix(vec3(0.05, 0.4, 0.9), vec3(1.0, 0.5, 0.1), t);
}

// Central difference normal estimation
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    mandelbulbDE(p + e.xyy) - mandelbulbDE(p - e.xyy),
    mandelbulbDE(p + e.yxy) - mandelbulbDE(p - e.yxy),
    mandelbulbDE(p + e.yyx) - mandelbulbDE(p - e.yyx)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  // Mouse parallax + slow orbit
  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  float angle = uTime * 0.1 + uRotateY + mouseNDC.x * 0.5;
  float pitch = 0.3 + mouseNDC.y * 0.2;

  vec3 ro = vec3(sin(angle)*cos(pitch), sin(pitch), cos(angle)*cos(pitch)) * 2.2;
  vec3 target = vec3(0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), fwd));
  vec3 up2 = cross(fwd, right);
  vec3 rd = normalize(uv.x * right + uv.y * up2 + 1.6 * fwd);

  // Raymarching
  float t = 0.0;
  float tMax = 6.0;
  bool hit = false;
  vec3 pos = ro;
  for (int i = 0; i < 80; i++) {
    pos = ro + rd * t;
    float d = mandelbulbDE(pos);
    if (d < 0.001) { hit = true; break; }
    if (t > tMax) break;
    t += d * 0.6; // conservative step for fractal
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
    vec3 orb = orbitColor(pos);

    // Blend orbit trap with env reflection
    vec3 fractalCol = mix(envRefl, orb, uColorMix);
    col = mix(fractalCol, envRefl, F * 0.6);

    // Key light specular
    vec3 keyDir  = normalize(vec3(0.6, 0.7, 0.4));
    vec3 halfDir = normalize(keyDir - rd);
    float spec   = pow(max(dot(nor, halfDir), 0.0), 64.0);
    col += vec3(1.0, 0.95, 0.85) * spec * 1.2;

    // Ambient occlusion approximation via DE gradient
    float ao = clamp(mandelbulbDE(pos + nor * 0.08) / 0.08, 0.0, 1.0);
    col *= 0.3 + 0.7 * ao;
  }

  // Tone map + gamma
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
