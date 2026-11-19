---
'@weasel-js/audio': patch
---

`createOscillatorNode` throws a `RangeError` for a `frequency` that is not finite when it is made, rather than when the graph next starts it.

<!-- entry: fix -->
