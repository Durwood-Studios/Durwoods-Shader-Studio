// gyroid/shader.frag — v1
// Assembled reference copy (PRECISION + NOISE + SDF_PRIMITIVES + FRESNEL + ENV + SHAPE).
// Edit frag.ts; keep this file in sync as the human-readable reference.

precision highp float;

// ─── (Noise, SDF primitives, Fresnel, ENV omitted for brevity — identical to glass-orb) ───

// ─── Shape uniforms & main ────────────────────────────────────────────────────

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

float gyroidSDF(vec3 p) {
  return abs(dot(sin(p), cos(p.yzx))) - uThickness;
}

float schwarzP(vec3 p) {
  return abs(cos(p.x) + cos(p.y) + cos(p.z)) - uThickness;
}

float tpms(vec3 p) {
  vec3 sp = p * uScale;
  return mix(gyroidSDF(sp), schwarzP(sp), uMorph) / max(uScale, 1.0);
}

float sceneSDF(vec3 p) {
  return max(tpms(p), sdSphere(p, 1.5));
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
    sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
    sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
  ));
}

mat3 rotMatY(float a) {
  float c = cos(a); float s = sin(a);
  return mat3(c, 0.0, s,  0.0, 1.0, 0.0,  -s, 0.0, c);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec3 ro = vec3(mouseNDC.x * 0.4, 0.3 + mouseNDC.y * 0.3, 3.2);
  vec3 rd = normalize(vec3(uv, -2.0));
  mat3 rot = rotMatY(uTime * 0.15);
  rd = rot * rd;
  ro = rot * ro;

  float t = 0.5;
  bool hit = false;
  vec3 pos = ro;
  for (int i = 0; i < 80; i++) {
    pos = ro + rd * t;
    float d = sceneSDF(pos);
    if (d < 0.001) { hit = true; break; }
    if (t > 6.0) break;
    t += max(d, 0.005);
  }

  vec3 col;
  if (!hit) {
    col = studioEnv(rd, uEnvHue, uEnvBright, uFloorMix);
  } else {
    vec3 nor = calcNormal(pos);
    vec3 reflDir = reflect(rd, nor);
    vec3 refrDir = refract(rd, nor, 1.0 / 1.4);
    float cosTheta = max(dot(-rd, nor), 0.0);
    float f0 = mix(0.04, 0.6, uMetallic);
    float F  = fresnelSchlick(cosTheta, f0);
    vec3 refl = studioEnv(reflDir, uEnvHue, uEnvBright, uFloorMix);
    vec3 refr = (refrDir == vec3(0.0)) ? refl : studioEnv(refrDir, uEnvHue, uEnvBright, uFloorMix);
    vec3 metalTint = mix(vec3(1.0), vec3(1.0, 0.85, 0.55), uMetallic);
    refl *= metalTint;
    col = mix(mix(refr, refl, F), refl, uMetallic);
    vec3 keyDir  = normalize(vec3(0.6, 0.7, 0.4));
    vec3 halfDir = normalize(keyDir - rd);
    float spec   = pow(max(dot(nor, halfDir), 0.0), 96.0);
    col += vec3(1.0, 0.95, 0.85) * spec * mix(0.6, 2.0, uMetallic);
    float ao = clamp(sceneSDF(pos + nor * 0.05) / 0.05, 0.0, 1.0);
    col *= 0.35 + 0.65 * ao;
  }

  col = col / (col + 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  col *= 1.0 - smoothstep(0.6, 1.4, length(uv) * 0.6);
  gl_FragColor = vec4(col, 1.0);
}
