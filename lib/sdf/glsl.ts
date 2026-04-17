/**
 * lib/sdf/glsl.ts
 *
 * Shared GLSL string constants for the Shader Studio material system.
 * Import these into any shader's frag.ts and concatenate before shape-specific code.
 *
 * Assembly order (guarantees WebGL 1 compile):
 *   PRECISION_GLSL  (must be first)
 *   NOISE_GLSL
 *   SDF_PRIMITIVES_GLSL
 *   SDF_OPS_GLSL
 *   FRESNEL_GLSL
 *   ENV_GLSL
 *   <shape-specific GLSL>
 */

// ─── Precision declaration ────────────────────────────────────────────────────
// Place first in the concatenated string — WebGL 1 requires precision before
// any float variable declarations.
export const PRECISION_GLSL = "precision highp float;";

// ─── Noise primitives ─────────────────────────────────────────────────────────
export const NOISE_GLSL = /* glsl */ `
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
      mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}
`;

// ─── SDF primitives ───────────────────────────────────────────────────────────
export const SDF_PRIMITIVES_GLSL = /* glsl */ `
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
`;

// ─── SDF boolean / domain operators ──────────────────────────────────────────
export const SDF_OPS_GLSL = /* glsl */ `
float opUnion(float a, float b) {
  return min(a, b);
}

float opSmoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

vec3 opTwist(vec3 p, float k) {
  float c = cos(k * p.y);
  float s = sin(k * p.y);
  mat2 m = mat2(c, -s, s, c);
  return vec3(m * p.xz, p.y);
}
`;

// ─── Fresnel ──────────────────────────────────────────────────────────────────
export const FRESNEL_GLSL = /* glsl */ `
// Schlick Fresnel approximation.
// cosTheta: dot(-rayDir, surfaceNormal)
// f0: reflectance at normal incidence (0.04 for glass/water)
float fresnelSchlick(float cosTheta, float f0) {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
`;

// ─── Procedural studio HDR environment ───────────────────────────────────────
// Used by glass-orb and any future shape that wants a photographic studio look.
// studioEnv() is called up to 4× per pixel in the glass-orb shader (3 refraction
// samples + 1 reflection), so it is deliberately simple: gradient + two analytic
// light disks — no texture lookups.
//
// Parameters (all uniform-driven):
//   hue      — shifts the global colour temperature (0 = warm, 1 = cool)
//   bright   — overall exposure multiplier
//   floorMix — how much the dark floor absorbs the downward hemisphere
export const ENV_GLSL = /* glsl */ `
vec3 studioEnv(vec3 dir, float hue, float bright, float floorMix) {
  float up = clamp(dir.y, -1.0, 1.0);

  // Sky / horizon / floor gradient
  vec3 skyCol     = vec3(0.82, 0.85, 0.92);
  vec3 horizonCol = vec3(1.00, 0.97, 0.90);
  vec3 floorCol   = mix(vec3(0.04, 0.04, 0.06), vec3(0.08, 0.06, 0.05), clamp(-up, 0.0, 1.0));

  vec3 col = mix(floorCol, horizonCol, smoothstep(-0.05, 0.05, up));
  col = mix(col, skyCol, smoothstep(0.0, 0.8, up));

  // Overhead softbox — tight disk centred on +Y
  float softbox = smoothstep(0.88, 0.98, dir.y) * 4.5;
  col += vec3(1.0, 0.98, 0.92) * softbox;

  // Key light — top-right fill disk
  vec3 keyDir = normalize(vec3(0.6, 0.7, 0.4));
  float key = pow(max(dot(dir, keyDir), 0.0), 40.0) * 2.5;
  col += vec3(1.0, 0.96, 0.88) * key;

  // Hue tint: shifts warm/cool balance without fully overriding the lighting
  vec3 hueTint = vec3(1.0 - 0.3 * hue, 0.95, 0.7 + 0.3 * hue);
  col *= mix(vec3(1.0), hueTint, 0.35);

  // Floor darkening — only affects downward-facing rays
  float floorMask = smoothstep(0.0, -0.3, up);
  col = mix(col, col * 0.25, floorMask * floorMix);

  return col * bright;
}
`;
