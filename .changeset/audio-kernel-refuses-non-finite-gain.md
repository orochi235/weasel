---
'@weasel-js/audio': patch
---

The voice kernels and `renderNote`/`renderNoise` throw a `RangeError` for a gain that is not finite, as `playNote` does.

<!-- entry: fix -->
