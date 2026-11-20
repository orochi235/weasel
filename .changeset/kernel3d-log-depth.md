---
'@weasel-js/kernel3d': minor
'@weasel-js/labkit': patch
---

A camera with `depth: 'log'` writes logarithmic depth, so surfaces 1 m apart 1e6 m away stay in order with near 0.1 and far 2e6.

`Camera3d.depth` is `'standard'` by default. The line pass tests against log depth when drawn with `{ logDepth: frame.logDepth }`. A host drawing meshes into the same buffer pastes `LOG_DEPTH_GLSL` into its fragment shader, uploads `logDepthUniform(frame.logDepth)` and writes `gl_FragDepth = weaselLogDepth(u_logDepth)`; `logDepthAt` is the same depth on the CPU. labkit's 3D view keeps a camera's `depth` when it fills in missing fields.

<!-- entry: rank=10 new api -->
