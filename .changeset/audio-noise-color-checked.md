---
'@weasel-js/audio': patch
---

`playNoise` and `createNoiseNode` throw a `RangeError` on a noise color other than `white`, `pink`, or `brown`.

<!-- entry: fix -->
