# Mandelbulb Shader — Authoring Notes

## Algorithm

Raymarches the degree-N Mandelbulb 3D fractal using the standard polar-coordinate
distance estimator (DE). The DE is conservative, so step size is scaled by 0.6 to
avoid overstepping thin fractal tendrils.

## Uniforms

- `uPower` — bulb exponent; 8 gives the classic "spiky ball" form, lower values
  produce smoother blobs, higher values sharpen the spines.
- `uIterations` — loop count; more iterations reveal finer detail at a GPU cost.
- `uBail` — bailout radius; values below 2 clip the exterior shell.
- `uColorMix` — blends orbit-trap colour (0 = pure env reflection, 1 = pure trap).
- `uRotateY` — manual Y-axis offset added to the auto-orbit angle.

## Performance

- 80 raymarch steps, max 12 DE iterations, epsilon 0.001, max distance 6.
- Target: 60 fps @ 1440×900 M1 Air. If frame time spikes, lower `uIterations`.

## Orbit-Trap Coloring

Tracks the minimum absolute Z-coordinate of the orbit; maps it to a blue→orange
gradient blended with the studio environment reflection via `uColorMix`.

## Normal Estimation

Central-difference 6-tap FD gradient, offset 0.001. Gives smooth normals on the
fractal surface for Fresnel and specular calculations.

## Camera

Spherical orbit around origin, radius 2.2. Auto-spins at `uTime * 0.1` plus
`uRotateY` offset plus mouse-X parallax (±0.5 rad). Mouse-Y tilts pitch ±0.2 rad.

## Shading Pipeline

Fresnel blend of orbit-trap colour with env reflection, plus Blinn-Phong specular
(exponent 64) and a single-step AO derived from the DE at `normal * 0.08`.
