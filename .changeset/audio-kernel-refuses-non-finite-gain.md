---
'@weasel-js/audio': patch
---

`createNoteKernel`, `createNoiseKernel`, `renderNote` and `renderNoise` throw a `RangeError` for a gain that is not finite, as `playNote` does, rather than rendering every sample as `NaN`.

<!-- entry: fix -->
