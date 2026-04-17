// glass-orb/shader.frag — v2
// Assembled form of frag.ts (PRECISION + NOISE + SDF_PRIMITIVES + FRESNEL + ENV + SHAPE).
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

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdOctahedron(vec3 p, float s) {
  p = abs(p);
  return (p.x + p.y + p.z - s) * 0.57735027;
}

float sdHexPrism(vec3 p, vec2 h) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
  p = abs(p);
  p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
  vec2 d = vec2(
    length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
    p.z - h.y
  );
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// ─── Fresnel ──────────────────────────────────────────────────────────────────

float fresnelSchlick(float cosTheta, float f0) {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// ─── Procedural studio HDR environment ───────────────────────────────────────

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
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec3 ro = vec3(mouseNDC.x * 0.3, mouseNDC.y * 0.3 + 0.1, 2.6);
  vec3 rd = normalize(vec3(uv, -1.8));

  float r    = uRadius * 1.5;
  float b    = dot(rd, ro);
  float c    = dot(ro, ro) - r * r;
  float disc = b * b - c;

  vec3 col;

  if (disc < 0.0) {
    col = studioEnv(rd, uEnvHue, uEnvBright, uFloorMix);
  } else {
    float t  = -b - sqrt(disc);
    vec3 hit = ro + rd * t;
    vec3 nor = normalize(hit);

    if (uWobble > 0.0) {
      vec3 wob = vec3(
        noise3(hit * 3.0 + vec3(uTime * 0.3,  0.0,          0.0)),
        noise3(hit * 3.0 + vec3(0.0,           uTime * 0.3,  0.0)),
        noise3(hit * 3.0 + vec3(0.0,           0.0,          uTime * 0.3))
      ) * 2.0 - 1.0;
      nor = normalize(nor + wob * uWobble);
    }

    float cosTheta = max(dot(-rd, nor), 0.0);
    float F = fresnelSchlick(cosTheta, 0.04);

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

    vec3 refrR = refract(rd, nor, 1.0 / (uIOR - uDispersion));
    vec3 refrG = refract(rd, nor, 1.0 /  uIOR);
    vec3 refrB = refract(rd, nor, 1.0 / (uIOR + uDispersion));
    vec3 refr;
    refr.r = studioEnv(refrR, uEnvHue, uEnvBright, uFloorMix).r;
    refr.g = studioEnv(refrG, uEnvHue, uEnvBright, uFloorMix).g;
    refr.b = studioEnv(refrB, uEnvHue, uEnvBright, uFloorMix).b;

    col = mix(refr, refl, F);

    vec3  keyDir  = normalize(vec3(0.6, 0.7, 0.4));
    vec3  halfDir = normalize(keyDir - rd);
    float spec    = pow(max(dot(nor, halfDir), 0.0), 128.0);
    col += vec3(spec) * 1.6 * max(0.0, 1.0 - uRoughness * 2.0);
  }

  col = col / (col + 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  col *= 1.0 - smoothstep(0.6, 1.4, length(uv) * 0.6);

  gl_FragColor = vec4(col, 1.0);
}
