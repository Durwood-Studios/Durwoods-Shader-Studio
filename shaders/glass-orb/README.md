# glass-orb

A refractive glass sphere rendered in a single WebGL 1 fragment shader.

## Uniforms

| Name          | Range     | Default | Description                              |
| ------------- | --------- | ------- | ---------------------------------------- |
| `uIOR`        | 1.0 – 2.0 | 1.48    | Index of refraction (glass ≈ 1.5)        |
| `uRadius`     | 0.1 – 0.9 | 0.42    | Sphere radius in normalised screen units |
| `uDispersion` | 0.0 – 0.1 | 0.03    | Chromatic aberration spread across RGB   |
| `uBgHue`      | 0.0 – 1.0 | 0.58    | Base hue of the gradient background      |

## Technique

Ray-sphere intersection via reconstructed surface normal, `refract()` GLSL built-in for RGB channels individually to simulate dispersion, Schlick-ish Fresnel blend, single specular highlight.

## Performance

Single `refract()` call per channel (3×) — GPU-light. Runs at 60 fps on integrated graphics.
