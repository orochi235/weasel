---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

The named easings (`easeInQuad` … `easeInOutBounce`, `EASINGS`) are the curves `@msb235/blits` runs under those names.

A named curve plays the same in weasel as on blits' GPU path. blits stores each as a CSS cubic-bezier within 0.003 of Penner's function, or as `linear()` points within 0.001 where no cubic fits, so values move by up to that much: easeInOutCubic by 0.0026 at most, every other curve by under 0.001. Each still starts at exactly 0 and ends at exactly 1. geom now depends on `@msb235/blits`.

<!-- entry: behavior -->
