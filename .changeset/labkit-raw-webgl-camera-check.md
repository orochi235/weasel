---
'@weasel-js/labkit': patch
---

A trial whose instrument leaves `orbit` undeclared now also warns and shows its "no camera" badge when a hand-written WebGL or WebGPU view in it turns on depth testing, which weasel's own 2D renderer never does: WebGL through `enable(DEPTH_TEST)`, WebGPU through a render pipeline with a depth test, built by the device its canvas is configured with.
