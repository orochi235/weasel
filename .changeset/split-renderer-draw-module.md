---
'@weasel-js/core': patch
---

The renderer's draw module is split by owner into `renderer/draw/` (uniforms, custom shaders, effects, stencil, clip, batch, gradient, paint binding, path painters, text, the scratch pass, and images), with no behavior change; `draw.ts` keeps `dispatch` and every export it had.
