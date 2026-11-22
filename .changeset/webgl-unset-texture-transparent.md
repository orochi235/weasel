---
'@weasel-js/renderer': patch
---

On WebGL, a texture slot with nothing to read reads transparent black, as on WebGPU, rather than opaque black. That is a slot with no texture set, or one holding the target being drawn into.

<!-- entry: fix visual -->
