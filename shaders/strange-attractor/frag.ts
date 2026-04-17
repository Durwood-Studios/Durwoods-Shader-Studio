/**
 * Strange Attractor — fragment shader source (v1).
 *
 * Renders a stylized Lissajous/attractor ribbon as a glowing 3D curve.
 * Uses a parametric approximation of the Aizawa attractor's shape
 * (full ODE iteration per pixel is too expensive for WebGL 1 at 60fps).
 * 64 curve segments are evaluated per pixel as line-segment SDFs, then
 * additively accumulated into a luminous ribbon.
 *
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

// Parametric Lissajous-attractor curve sampled at parameter s in [0, 1].
// The shape approximates the Aizawa attractor's characteristic toroidal ribbon
// using a modulated parametric curve: sin/cos combinations tuned to reproduce
// the topology without ODE integration per pixel.
vec3 attractorPoint(float s) {
  float t2 = s * 6.2831853;
  // Primary orbit
  float x = sin(t2 * uA) * cos(t2 * uC * 0.37);
  float y = sin(t2 * uB) * sin(t2 * uA * 0.41);
  float z = cos(t2) * uC * 1.3;
  // Secondary modulation to break symmetry (Aizawa-like warping)
  x += sin(t2 * 3.0 * uB) * 0.18 * (1.0 - uC);
  y += cos(t2 * 2.0 * uA) * 0.14 * uC;
  z += sin(t2 * uA * 2.5) * 0.10 * uB;
  return vec3(x, y, z) * uScale;
}

// Rotate around Y
mat3 rotY(float a) {
  float c = cos(a); float s = sin(a);
  return mat3(c, 0.0, s,  0.0, 1.0, 0.0,  -s, 0.0, c);
}
// Rotate around X
mat3 rotX(float a) {
  float c = cos(a); float s = sin(a);
  return mat3(1.0, 0.0, 0.0,  0.0, c, -s,  0.0, s, c);
}

// Minimum distance from 3D point p to a line segment [a,b]
float segDist(vec3 p, vec3 a, vec3 b) {
  vec3 ab = b - a;
  float t = clamp(dot(p - a, ab) / (dot(ab, ab) + 1e-6), 0.0, 1.0);
  return length(p - a - ab * t);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec2 mouseNDC = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  // Camera: orbit around origin, driven by time + mouse
  float camAngle = uTime * 0.12 + mouseNDC.x * 1.2;
  float camPitch = 0.35 + mouseNDC.y * 0.4;
  vec3 ro = vec3(sin(camAngle)*cos(camPitch), sin(camPitch), cos(camAngle)*cos(camPitch)) * 3.0;
  vec3 fwd = normalize(-ro);
  vec3 right2 = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up2 = cross(fwd, right2);
  vec3 rd = normalize(uv.x * right2 + uv.y * up2 + 1.8 * fwd);

  // Show environment behind the ribbon
  vec3 bgCol = studioEnv(rd, uEnvHue, uEnvBright, uFloorMix);

  // Accumulate glow from 64 ribbon segments projected into screen-space depth
  // We raymarch a thin volume: for each pixel, find closest approach to the curve
  float totalGlow = 0.0;
  vec3  glowCol   = vec3(0.0);

  // We need the 3D closest point on the ribbon for coloring.
  // Strategy: find closest segment by distance in 3D (along the ray).
  float minDist3D = 1e9;
  float closestS  = 0.0;

  for (int i = 0; i < 64; i++) {
    float s0 = float(i)        / 64.0;
    float s1 = float(i + 1)    / 64.0;
    vec3 p0 = attractorPoint(s0);
    vec3 p1 = attractorPoint(s1);

    // Find closest approach of ray to segment midpoint (cheap bilateral approximation)
    vec3 pm = (p0 + p1) * 0.5;

    // Distance of ray from segment midpoint via capsule SDF along ray
    // Project pm onto ray, find offset
    float proj = dot(pm - ro, rd);
    vec3  closest = ro + rd * max(proj, 0.2);

    // 3D distance from closest ray point to segment [p0,p1]
    float d3d = segDist(closest, p0, p1);

    // Width in world space: 0.045 ribbon radius
    float ribbonR = 0.045;
    float contrib = max(0.0, 1.0 - d3d / (ribbonR * 4.0));
    contrib = contrib * contrib; // sharpen falloff

    // Hue varies along the curve for rainbow ribbon effect
    float hue = fract(s0 + uTime * 0.05);
    // Simple HSV-like colour wheel
    vec3 segCol;
    segCol.r = clamp(abs(hue * 6.0 - 3.0) - 1.0, 0.0, 1.0);
    segCol.g = clamp(2.0 - abs(hue * 6.0 - 2.0), 0.0, 1.0);
    segCol.b = clamp(2.0 - abs(hue * 6.0 - 4.0), 0.0, 1.0);

    glowCol   += segCol * contrib;
    totalGlow += contrib;

    if (d3d < minDist3D) {
      minDist3D = d3d;
      closestS  = s0;
    }
  }

  // Normalise accumulated glow
  float glowStrength = clamp(totalGlow * uGlow * 0.4, 0.0, 1.0);

  // Bloom: soft glow halo wider than the core
  float bloom = clamp(totalGlow * uGlow * 0.15, 0.0, 1.0);
  vec3 bloomCol = glowCol / (totalGlow + 0.001);

  // Composite: background + bloom halo + core ribbon
  vec3 col = bgCol;
  col = mix(col, bloomCol * 1.5, bloom * 0.5);
  col += glowCol * glowStrength * 1.2;

  // Subtle emissive core pulse
  col += bloomCol * smoothstep(0.6, 1.0, glowStrength) * 0.4 * uGlow;

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
