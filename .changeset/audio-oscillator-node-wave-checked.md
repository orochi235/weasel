---
'@weasel-js/audio': patch
---

`createOscillatorNode` throws a `RangeError` on an unknown wave name, an empty or non-finite harmonic wave, or partials.

<!-- entry: fix -->
