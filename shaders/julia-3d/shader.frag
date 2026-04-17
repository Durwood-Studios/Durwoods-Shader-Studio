// julia-3d/shader.frag — v1
// Assembled reference copy (PRECISION + NOISE + SDF_PRIMITIVES + FRESNEL + ENV + SHAPE).
// Edit frag.ts; keep this file in sync as the human-readable reference.

precision highp float;

// ─── (Noise, SDF primitives, Fresnel, ENV — identical to glass-orb) ──────────

// ─── Shape uniforms & main ────────────────────────────────────────────────────

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

vec4 qmul(vec4 a, vec4 b) {
  return vec4(
    a.x*b.x - a.y*b.y - a.z*b.z - a.w*b.w,
    a.x*b.y + a.y*b.x + a.z*b.w - a.w*b.z,
    a.x*b.z - a.y*b.w + a.z*b.x + a.w*b.y,
    a.x*b.w + a.y*b.z - a.z*b.y + a.w*b.x
  );
}

float juliaDE(vec3 p) {
  vec4 q  = vec4(0.0, p.x, p.y, p.z);
  vec4 c  = vec4(uCx, uCy, uCz, uCw);
  vec4 dq = vec4(1.0, 0.0, 0.0, 0.0);
  for (int i = 0; i < 12; i++) {
    if (float(i) >= uIterations) break;
    dq = 2.0 * qmul(q, dq);
    q  = qmul(q, q) + c;
    if (dot(q, q) > 64.0) break;
  }
  float r  = length(q);
  float dr = length(dq);
  if (dr < 1e-6) return 0.0;
  return 0.5 * r * log(r) / dr;
}

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
  vec3 col;
  col.r = clamp(abs(t * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  col.g = clamp(2.0 - abs(t * 6.0 - 2.0), 0.0, 1.0);
  col.b = clamp(2.0 - abs(t * 6.0 - 4.0), 0.0, 1.0);
  return col;
}

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
  float angle = uTime * 0.08 + mouseNDC.x * 0.7;
  float pitch = 0.25 + mouseNDC.y * 0.25;
  vec3 ro = vec3(sin(angle)*cos(pitch), sin(pitch), cos(angle)*cos(pitch)) * 2.4;
  vec3 fwd = normalize(-ro);
  vec3 right2 = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up2 = cross(fwd, right2);
  vec3 rd = normalize(uv.x * right2 + uv.y * up2 + 1.7 * fwd);

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
    float cosTheta = max(dot(-rd, nor), 0.0);
    float F = fresnelSchlick(cosTheta, 0.04);
    vec3 envRefl = studioEnv(reflDir, uEnvHue, uEnvBright, uFloorMix);
    vec3 orb = juliaOrbitColor(pos);
    vec3 refrDir = refract(rd, nor, 1.0 / 1.5);
    vec3 refr = (refrDir == vec3(0.0)) ? envRefl : studioEnv(refrDir, uEnvHue, uEnvBright, uFloorMix);
    vec3 base = mix(refr, orb, 0.55);
    col = mix(base, envRefl, F * 0.5);
    vec3 keyDir  = normalize(vec3(0.6, 0.7, 0.4));
    vec3 halfDir = normalize(keyDir - rd);
    float spec   = pow(max(dot(nor, halfDir), 0.0), 80.0);
    col += vec3(1.0, 0.95, 0.85) * spec * 1.0;
    float ao = clamp(juliaDE(pos + nor * 0.07) / 0.07, 0.0, 1.0);
    col *= 0.25 + 0.75 * ao;
  }

  col = col / (col + 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  col *= 1.0 - smoothstep(0.6, 1.4, length(uv) * 0.6);
  gl_FragColor = vec4(col, 1.0);
}
