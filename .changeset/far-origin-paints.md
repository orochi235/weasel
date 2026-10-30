---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

Shader commands and mesh gradients stay exact far from the origin. A shader command's kit vertex stage now
takes `u_worldOrigin`, a world point near its bounds, and `u_screenToLocal`, composed in doubles, and exposes
`v_worldLocal`, the world point measured from that origin, beside `v_world`, which it now computes from them
rather than by inverting `u_view` in float32. A consumer shader drawing detail far out reads `v_worldLocal`
(a periodic one, `mod(u_worldOrigin, P) + v_worldLocal`); `u_screenToLocal` and `u_worldOrigin` are kit
uniforms, so a shader must not set them. `PaintBindContext.spaceInverse` takes an optional point to measure
paint space from, subtracted in doubles; the mesh gradient measures from its bake's corner and its vertex
stage takes `u_origin`, so its geometry is rebased like the kit's own paths.
