---
"@weasel-js/d3": patch
---

A transition's `duration(NaN)` throws a `RangeError` where it is set, so the transition can no longer fail later and never settle.

<!-- entry: rank=-5 fix -->
