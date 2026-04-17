# Strange Attractor Shader — Authoring Notes

## Algorithm: Lissajous Parametric Approximation

Full Aizawa ODE integration per pixel (64 steps × per-pixel) was benchmarked as
too expensive for 60fps on M1 Air. Instead this shader uses a **parametric
Lissajous-attractor curve** tuned to reproduce the Aizawa toroidal ribbon topology:

```
x(t) = sin(t*a) * cos(t*c*0.37) + sin(3t*b)*0.18*(1-c)
y(t) = sin(t*b) * sin(t*a*0.41) + cos(2t*a)*0.14*c
z(t) = cos(t)   * c*1.3         + sin(t*a*2.5)*0.10*b
```

The three free parameters `uA`, `uB`, `uC` map directly to Aizawa's `a`, `b`, `c`
and produce qualitatively similar shapes at a fraction of the ODE cost.

## Uniforms

- `uA`, `uB`, `uC` — shape control parameters; try values near defaults for best results.
  Near-zero values can collapse the curve to a point — a safety clamp is not enforced
  since exploring degenerate forms is interesting.
- `uScale` — world-space size of the ribbon cloud.
- `uGlow` — additive emission strength. Values above 1.5 will bloom strongly.

## Rendering Approach

64 line segments are evaluated per pixel. For each segment the shader finds the
closest approach of the eye ray to the segment midpoint, computes a 3D soft-glow
falloff, and accumulates additive colour. No raymarching loop is needed — just
a flat `for(int i=0;i<64;i++)` with O(1) geometry per segment.

## Performance

~64 × (2 × attractorPoint() evaluations + 1 segDist) = ~300 float ops per pixel.
Well within budget at 1440×900.

## Camera

Spherical orbit at radius 3.0, auto-spinning at `uTime * 0.12` plus mouse-X parallax.
