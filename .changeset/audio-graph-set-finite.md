---
"@weasel-js/audio": patch
---

An audio graph's `set` throws a `RangeError` for a value or ramp that is not finite, even on a node that is not sounding.

<!-- entry: rank=-5 fix -->
