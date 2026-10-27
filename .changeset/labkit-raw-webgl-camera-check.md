---
'@weasel-js/labkit': patch
---

A trial whose instrument leaves `orbit` undeclared now also warns and shows its "no camera" badge when a hand-written WebGL view in it turns on depth testing, which weasel's own 2D renderer never does. A raw WebGPU view is still not seen.
