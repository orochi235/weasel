---
'@weasel-js/audio': patch
---

`stream` throws a `RangeError` at the call on an `offset` that is negative or not finite, and leaves the element's current stream playing.

<!-- entry: fix -->
