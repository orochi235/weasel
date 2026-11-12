---
'@weasel-js/ui': patch
---

`domMeasureEnv` measures text in a font whose `--wzl-font-ui` is a single family name with a space or digit (`Font 3D`), rather than in the canvas's 10px default.

<!-- entry: fix -->
