---
'@weasel-js/audio': patch
---

`createOscillatorNode` throws a `RangeError` on a wave name other than the four built-ins, an empty or non-finite harmonic wave, or inharmonic partials.

<!-- entry: fix -->
