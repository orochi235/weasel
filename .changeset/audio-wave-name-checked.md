---
'@weasel-js/audio': patch
---

`playNote` throws a `RangeError` at the call on a wave name other than `sine`, `square`, `sawtooth`, or `triangle`.

<!-- entry: fix -->
