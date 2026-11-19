---
'@weasel-js/audio': patch
---

`createOscillatorNode` throws a `RangeError` on a non-finite `frequency` when it is built, as `createGainNode` does.

<!-- entry: fix -->
