---
'@weasel-js/renderer': minor
---

A registered paint kind takes its group's color matrix, on paths and on text, in `u_colorMatrix` and `u_colorBias`.

A program declaring neither draws unmapped, with a one-time development warning.

Apply them in the fragment shader to the straight color before premultiplying:

```glsl
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
// …
vec4 mapped = clamp(u_colorMatrix * color + u_colorBias, 0.0, 1.0);
```

<!-- entry: fix api visual -->
