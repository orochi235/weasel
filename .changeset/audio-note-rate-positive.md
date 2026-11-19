---
'@weasel-js/audio': patch
---

A `playNote` voice's `setRate` throws a `RangeError` on a rate of 0 or below, on nodes and in the worklet alike, and the voice keeps its last rate.

<!-- entry: fix -->
