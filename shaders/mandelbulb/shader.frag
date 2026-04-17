// mandelbulb/shader.frag — v1
// Assembled reference copy (PRECISION + NOISE + SDF_PRIMITIVES + FRESNEL + ENV + SHAPE).
// Edit frag.ts; keep this file in sync as the human-readable reference.

precision highp float;

// ─── Noise ────────────────────────────────────────────────────────────────────

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(hash31(i + vec3(0.0,0.0,0.0)), hash31(i + vec3(1.0,0.0,0.0)), f.x),
      mix(hash31(i + vec3(0.0,1.0,0.0)), hash31(i + vec3(1.0,1.0,0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash31(i + vec3(0.0,0.0,1.0)), hash31(i + vec3(1.0,0.0,1.0)), f.x),
      mix(hash31(i + vec3(0.0,1.0,1.0)), hash31(i + vec3(1.0,1.0,1.0)), f.x),
      f.y
    ),
    f.z
  );
}

// ─── SDF primitives ───────────────────────────────────────────────────────────

float sdSphere(vec3 p, float r) { return length(p) - r; }

// ─── Fresnel ──────────────────────────────────────────────────────────────────

float fresnelSchlick(float cosTheta, float f0) {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// ─── Environment ──────────────────────────────────────────────────────────────

vec3 studioEnv(vec3 dir, float hue, float bright, float floorMix) {
  float up = clamp(dir.y, -1.0, 1.0);
  vec3 skyCol     = vec3(0.82, 0.85, 0.92);
  vec3 horizonCol = vec3(1.00, 0.97, 0.90);
  vec3 floorCol   = mix(vec3(0.04, 0.04, 0.06), vec3(0.08, 0.06, 0.05), clamp(-up, 0.0, 1.0));
  vec3 col = mix(floorCol, horizonCol, smoothstep(-0.05, 0.05, up));
  col = mix(col, skyCol, smoothstep(0.0, 0.8, up));
  float softbox = smoothstep(0.88, 0.98, dir.y) * 4.5;
  col += vec3(1.0, 0.98, 0.92) * softbox;
  vec3  keyDir = normalize(vec3(0.6, 0.7, 0.4));
  float key    = pow(max(dot(dir, keyDir), 0.0), 40.0) * 2.5;
  col += vec3(1.0, 0.96, 0.88) * key;
  vec3 hueTint = vec3(1.0 - 0.3 * hue, 0.95, 0.7 + 0.3 * hue);
  col *= mix(vec3(1.0), hueTint, 0.35);
  float floorMask = smoothstep(0.0, -0.3, up);
  col = mix(col, col * 0.25, floorMask * floorMix);
  return col * bright;
}

// ─── Shape uniforms & main ────────────────────────────────────────────────────

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;

// @uniform power:       float, range:[2.0,12.0], default:8.0,  label:"Power",      group:"Fractal",     storage:"uint8"
uniform float uPower;
// @uniform iterations:  float, range:[2.0,12.0], default:6.0,  label:"Iterations", group:"Fractal",     storage:"uint8"
uniform float uIterations;
// @uniform bail:        float, range:[1.0,8.0],  default:2.0,  label:"Bailout",    group:"Fractal",     storage:"uint8"
uniform float uBail;
// @uniform colorMix:    float, range:[0.0,1.0],  default:0.5,  label:"Color Mix",  group:"Fractal",     storage:"uint8"
uniform float uColorMix;
// @uniform rotateY:     float, range:[0.0,6.28], default:0.0,  label:"Rotate Y",   group:"Fractal",     storage:"uint8"
uniform float uRotateY;
// @uniform envHue:      float, range:[0.0,1.0],  default:0.58, label:"Env Hue",    group:"Environment", storage:"uint8"
uniform float uEnvHue;
// @uniform envBright:   float, range:[0.3,2.0],  default:1.0,  label:"Env Bright", group:"Environment", storage:"uint8"
uniform float uEnvBright;
// @uniform floorMix:    float, range:[0.0,1.0],  default:0.35, label:"Floor Mix",  group:"Environment", storage:"uint8"
uniform float uFloorMix;

vec3 rotY(vec3 p, float a) {
  float c = cos(a); float s = sin(a);
  return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

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

vec3 orbitColor(vec3 p) {
  vec3  z    = p;
  float trap = 1e9;
  for (int i = 0; i < 12; i++) {
    if (float(i) >= uIterations) break;
    float r = length(z);
    if (r > uBail) break;
    trap = min(trap, abs(z.z));
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi   = atan(z.y, z.x);
    float zr    = pow(r, uPower);
    theta *= uPower;
    phi   *= uPower;
    z = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
    z += p;
  }
  float t = clamp(trap * 1.5, 0.0, 1.0);
  return mix(vec3(0.05, 0.4, 0.9), vec3(1.0, 0.5, 0.1), t);
}

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
  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  float angle = uTime * 0.1 + uRotateY + mouseNDC.x * 0.5;
  float pitch = 0.3 + mouseNDC.y * 0.2;
  vec3 ro = vec3(sin(angle)*cos(pitch), sin(pitch), cos(angle)*cos(pitch)) * 2.2;
  vec3 fwd = normalize(-ro);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), fwd));
  vec3 up2 = cross(fwd, right);
  vec3 rd = normalize(uv.x * right + uv.y * up2 + 1.6 * fwd);

  float t = 0.0;
  bool hit = false;
  vec3 pos = ro;
  for (int i = 0; i < 80; i++) {
    pos = ro + rd * t;
    float d = mandelbulbDE(pos);
    if (d < 0.001) { hit = true; break; }
    if (t > 6.0) break;
    t += d * 0.6;
  }

  vec3 col;
  if (!hit) {
    col = studioEnv(rd, uEnvHue, uEnvBright, uFloorMix);
  } else {
    vec3 nor = calcNormal(pos);
    vec3 reflDir = reflect(rd, nor);
    float cosTheta = max(dot(-rd, nor), 0.0);
    float F = fresnelSchlick(cosTheta, 0.04);
    vec3 envRefl = studioEnv(reflDir, uEnvHue, uEnvBright, uFloorMix);
    vec3 orb = orbitColor(pos);
    vec3 fractalCol = mix(envRefl, orb, uColorMix);
    col = mix(fractalCol, envRefl, F * 0.6);
    vec3 keyDir  = normalize(vec3(0.6, 0.7, 0.4));
    vec3 halfDir = normalize(keyDir - rd);
    float spec   = pow(max(dot(nor, halfDir), 0.0), 64.0);
    col += vec3(1.0, 0.95, 0.85) * spec * 1.2;
    float ao = clamp(mandelbulbDE(pos + nor * 0.08) / 0.08, 0.0, 1.0);
    col *= 0.3 + 0.7 * ao;
  }

  col = col / (col + 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  col *= 1.0 - smoothstep(0.6, 1.4, length(uv) * 0.6);
  gl_FragColor = vec4(col, 1.0);
}
