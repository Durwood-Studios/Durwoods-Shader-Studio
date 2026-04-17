# Gyroid Shader — Authoring Notes

## Algorithm

Raymarches a Triply Periodic Minimal Surface (TPMS) bounded by a sphere of radius 1.5.
The surface morphs between two classic TPMS families via `uMorph`:

- **Gyroid** (0): `|sin(x)cos(y) + sin(y)cos(z) + sin(z)cos(x)| - thickness`
- **Schwarz P** (1): `|cos(x)+cos(y)+cos(z)| - thickness`

## Uniforms

- `uScale` — spatial frequency; higher = finer tunnels. Above ~8 at 1440p may drop fps.
- `uThickness` — shell wall width. Very small values (<0.02) can cause aliasing.
- `uMorph` — continuous blend between Gyroid and Schwarz-P topology.
- `uMetallic` — 0 = dielectric glass-like, 1 = gold metallic with copper tint.

## Performance

- 80 raymarch steps, minimum step 0.005 to prevent infinite loops in near-flat regions.
- High `uScale` values increase DE cost; lower `uIterations` if perf drops.
- DE is divided by `max(uScale, 1.0)` to keep world-space step sizes valid.

## Bounding Volume

A sphere of radius 1.5 clips the infinite TPMS via `max(tpms, sdSphere)`.
This keeps the march bounded and provides a clean silhouette.

## Shading Pipeline

Fresnel blend of refraction and reflection. `uMetallic` lifts F0 from 0.04 to 0.6,
suppresses refraction, and applies a gold/copper tint to the reflection lobe.
Specular exponent 96, key-light direction matches glass-orb for visual continuity.

## Camera

Fixed at Z=3.2, mouse-parallax-shifted. Entire scene rotates on Y at `uTime * 0.15`.
Slow enough to reveal the tunnel structure without disorienting.
