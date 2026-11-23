---
'@weasel-js/audio': patch
---

A pattern player's `setDetune` and its `detune` option throw a `RangeError` on a number that is not finite, and `setDetune` keeps the detune it had.

<!-- entry: fix -->
