# Julia 3D Shader — Authoring Notes

## Algorithm

Raymarches a quaternion Julia set. The 3D sample point `p` is lifted to the
pure-imaginary quaternion `q = (0, p.x, p.y, p.z)`. The iteration is:

```
dq = 2 * q * dq     (chain rule derivative accumulation)
q  = q² + c         (quaternion squaring + constant)
```

The distance estimator is `0.5 * |q| * log|q| / |dq|` — the standard
quaternion Julia DE derived from Hubbard-Douady theory.

## Quaternion Multiplication

Implemented as a full 16-multiply `qmul(vec4, vec4)` function. WebGL 1 does not
have a native quaternion type, so all operations are explicit component-wise.

## Uniforms

- `uCx, uCy, uCz, uCw` — the quaternion constant `c`. Small changes produce
  dramatically different shapes. The defaults (0.4, -0.2, 0.1, -0.3) give a
  rounded multi-lobed form.
- `uIterations` — more iterations reveal finer detail. 8 is a good balance;
  12 may drop below 60fps on integrated GPU at 1440p.
- `uColorShift` — rotates the orbit-trap hue wheel, allowing any colour mood.

## Orbit-Trap Coloring

Tracks the minimum `|q|` over the iteration and which iteration achieved it.
Both values feed into a `fract()`-wrapped hue that drives a full-circle HSV
colour wheel, shifted by `uColorShift`.

## Performance

- 80 raymarch steps, 12-max iterations (exited early via `dot(q,q) > 64`).
- Conservative step factor 0.5 — quaternion Julia DEs are less tight than
  polynomial DEs, so the extra conservatism prevents tunnelling artefacts.

## Camera

Spherical orbit at radius 2.4, spinning at `uTime * 0.08`. Slower than Mandelbulb
to let users appreciate the subtler surface detail. Mouse-X adds ±0.7 rad.
