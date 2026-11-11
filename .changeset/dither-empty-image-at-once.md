---
"@weasel-js/dither": patch
---

`ditherPixels` and `protectMask` return at once for an image with no pixels, however long its other side.

<!-- entry: rank=-5 fix perf -->
