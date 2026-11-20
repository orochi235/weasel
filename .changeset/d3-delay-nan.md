---
'@weasel-js/d3': patch
---

A transition's `delay(NaN)` throws a `RangeError` where it is set, as `duration(NaN)` does, and a delay function answering `NaN` warns.

The item a delay function answers `NaN` for still starts at once.

<!-- entry: fix -->
