---
'@weasel-js/core': patch
---

`useScene({ ops })` and `createScene({ ops })` throw on a `kit:` kind, as `scene.registerOp` does, instead of replacing the kit's own op.

<!-- entry: fix -->
