---
'@weasel-js/renderer': patch
---

On WebGPU, a resolve past either target copies the part that fits, as on WebGL, rather than losing every draw submitted with it.

<!-- entry: fix -->
