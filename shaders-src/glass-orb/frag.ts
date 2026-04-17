/**
 * Glass Orb fragment shader source.
 * Source of truth is shader.frag — this file is the TS-importable version.
 * Run `pnpm gen:manifests` to regenerate from shader.frag annotations.
 */
const fragSrc = /* glsl */ `precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;

// @uniform ior: float, range:[1.0,2.0], default:1.48, label:"IOR", group:"Glass", storage:"uint8"
uniform float uIOR;
// @uniform radius: float, range:[0.1,0.9], default:0.42, label:"Radius", group:"Glass", storage:"uint8"
uniform float uRadius;
// @uniform dispersion: float, range:[0.0,0.1], default:0.03, label:"Dispersion", group:"Glass", storage:"uint8"
uniform float uDispersion;
// @uniform bgHue: float, range:[0.0,1.0], default:0.58, label:"Background Hue", group:"Scene", storage:"uint8"
uniform float uBgHue;

// HSV -> RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Background gradient with slow hue drift
vec3 background(vec2 uv) {
  float angle = atan(uv.y, uv.x) / (2.0 * 3.14159265) + 0.5;
  float h1 = uBgHue + angle * 0.25 + uTime * 0.04;
  float h2 = uBgHue + 0.5 + angle * 0.15 - uTime * 0.02;
  vec3 col1 = hsv2rgb(vec3(h1, 0.65, 0.55));
  vec3 col2 = hsv2rgb(vec3(h2, 0.55, 0.35));
  float t = smoothstep(-0.8, 0.8, uv.y + uv.x * 0.3);
  return mix(col2, col1, t);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  // Mouse parallax offset (normalised -1..1)
  vec2 mouse = (uMouse * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec2 orbCenter = mouse * 0.08;

  vec2 p = uv - orbCenter;
  float dist = length(p);

  // Background
  vec3 col = background(uv);

  if (dist < uRadius) {
    // Surface normal of sphere (z reconstructed)
    float z = sqrt(max(0.0, uRadius * uRadius - dot(p, p)));
    vec3 nor = normalize(vec3(p, z));

    // Fresnel factor
    float fresnel = pow(1.0 - max(0.0, dot(nor, vec3(0.0, 0.0, 1.0))), 3.0);
    fresnel = mix(0.04, 1.0, fresnel);

    // Refracted background - RGB channels with chromatic dispersion
    vec3 refracted = vec3(
      dot(background(uv + refract(vec3(0.0,0.0,-1.0), nor, 1.0/(uIOR - uDispersion)).xy * 0.4), vec3(1.0,0.2,0.2)),
      dot(background(uv + refract(vec3(0.0,0.0,-1.0), nor, 1.0/ uIOR             ).xy * 0.4), vec3(0.2,1.0,0.2)),
      dot(background(uv + refract(vec3(0.0,0.0,-1.0), nor, 1.0/(uIOR + uDispersion)).xy * 0.4), vec3(0.2,0.2,1.0))
    );

    // Specular highlight
    vec3 lightDir = normalize(vec3(-0.6, 0.8, 0.8));
    float spec = pow(max(0.0, dot(reflect(-lightDir, nor), vec3(0.0, 0.0, 1.0))), 64.0);

    col = mix(refracted, vec3(1.0), fresnel * 0.25);
    col += vec3(spec * 0.9);

    // Soft edge blend
    float edge = smoothstep(uRadius, uRadius - 0.01, dist);
    col = mix(background(uv), col, edge);
  }

  // Vignette
  col *= 1.0 - smoothstep(0.6, 1.4, length(uv) * 0.6);

  gl_FragColor = vec4(col, 1.0);
}
`;

export default fragSrc;
