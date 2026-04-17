// strange-attractor/shader.frag — v1
// Assembled reference copy (PRECISION + NOISE + SDF_PRIMITIVES + FRESNEL + ENV + SHAPE).
// Edit frag.ts; keep this file in sync as the human-readable reference.

precision highp float;

// ─── (Noise, SDF primitives, Fresnel, ENV — identical to glass-orb) ──────────

// ─── Shape uniforms & main ────────────────────────────────────────────────────

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;

// @uniform aParam:    float, range:[-2.0,2.0], default:0.95, label:"A Param",  group:"Attractor",   storage:"uint8"
uniform float uA;
// @uniform bParam:    float, range:[0.0,2.0],  default:0.7,  label:"B Param",  group:"Attractor",   storage:"uint8"
uniform float uB;
// @uniform cParam:    float, range:[0.0,1.0],  default:0.6,  label:"C Param",  group:"Attractor",   storage:"uint8"
uniform float uC;
// @uniform scale:     float, range:[0.3,2.0],  default:1.0,  label:"Scale",    group:"Attractor",   storage:"uint8"
uniform float uScale;
// @uniform glow:      float, range:[0.0,2.0],  default:1.2,  label:"Glow",     group:"Material",    storage:"uint8"
uniform float uGlow;
// @uniform envHue:    float, range:[0.0,1.0],  default:0.58, label:"Env Hue",  group:"Environment", storage:"uint8"
uniform float uEnvHue;
// @uniform envBright: float, range:[0.3,2.0],  default:1.0,  label:"Env Bright",group:"Environment",storage:"uint8"
uniform float uEnvBright;
// @uniform floorMix:  float, range:[0.0,1.0],  default:0.35, label:"Floor Mix",group:"Environment", storage:"uint8"
uniform float uFloorMix;

vec3 attractorPoint(float s) {
  float t2 = s * 6.2831853;
  float x = sin(t2 * uA) * cos(t2 * uC * 0.37);
  float y = sin(t2 * uB) * sin(t2 * uA * 0.41);
  float z = cos(t2) * uC * 1.3;
  x += sin(t2 * 3.0 * uB) * 0.18 * (1.0 - uC);
  y += cos(t2 * 2.0 * uA) * 0.14 * uC;
  z += sin(t2 * uA * 2.5) * 0.10 * uB;
  return vec3(x, y, z) * uScale;
}

float segDist(vec3 p, vec3 a, vec3 b) {
  vec3 ab = b - a;
  float t = clamp(dot(p - a, ab) / (dot(ab, ab) + 1e-6), 0.0, 1.0);
  return length(p - a - ab * t);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  float camAngle = uTime * 0.12 + mouseNDC.x * 1.2;
  float camPitch = 0.35 + mouseNDC.y * 0.4;
  vec3 ro = vec3(sin(camAngle)*cos(camPitch), sin(camPitch), cos(camAngle)*cos(camPitch)) * 3.0;
  vec3 fwd = normalize(-ro);
  vec3 right2 = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up2 = cross(fwd, right2);
  vec3 rd = normalize(uv.x * right2 + uv.y * up2 + 1.8 * fwd);

  vec3 bgCol = studioEnv(rd, uEnvHue, uEnvBright, uFloorMix);

  float totalGlow = 0.0;
  vec3  glowCol   = vec3(0.0);

  for (int i = 0; i < 64; i++) {
    float s0 = float(i)     / 64.0;
    float s1 = float(i + 1) / 64.0;
    vec3 p0 = attractorPoint(s0);
    vec3 p1 = attractorPoint(s1);
    vec3 pm = (p0 + p1) * 0.5;

    float proj = dot(pm - ro, rd);
    vec3  closest = ro + rd * max(proj, 0.2);
    float d3d = segDist(closest, p0, p1);

    float contrib = max(0.0, 1.0 - d3d / 0.18);
    contrib = contrib * contrib;

    float hue = fract(s0 + uTime * 0.05);
    vec3 segCol;
    segCol.r = clamp(abs(hue * 6.0 - 3.0) - 1.0, 0.0, 1.0);
    segCol.g = clamp(2.0 - abs(hue * 6.0 - 2.0), 0.0, 1.0);
    segCol.b = clamp(2.0 - abs(hue * 6.0 - 4.0), 0.0, 1.0);

    glowCol   += segCol * contrib;
    totalGlow += contrib;
  }

  float glowStrength = clamp(totalGlow * uGlow * 0.4, 0.0, 1.0);
  float bloom = clamp(totalGlow * uGlow * 0.15, 0.0, 1.0);
  vec3 bloomCol = glowCol / (totalGlow + 0.001);

  vec3 col = bgCol;
  col = mix(col, bloomCol * 1.5, bloom * 0.5);
  col += glowCol * glowStrength * 1.2;
  col += bloomCol * smoothstep(0.6, 1.0, glowStrength) * 0.4 * uGlow;

  col = col / (col + 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  col *= 1.0 - smoothstep(0.6, 1.4, length(uv) * 0.6);
  gl_FragColor = vec4(col, 1.0);
}
