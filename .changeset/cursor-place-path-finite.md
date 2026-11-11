---
"@weasel-js/cursor": patch
---

`placeCursorPath` throws a `RangeError` for a scale or move that puts a coordinate past the double range or makes it `NaN`.

A coordinate past 1e306 is written as itself.

<!-- entry: rank=-5 fix -->
