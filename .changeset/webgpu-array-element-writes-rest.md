---
'@weasel-js/renderer': patch
---

On WebGPU, setting an array uniform by an element's name, like `u_ripples[2]`, writes from there to the array's end, as WebGL does.

<!-- entry: fix -->
