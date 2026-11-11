---
"@weasel-js/cursor": patch
---

`placeCursorPath` throws a `RangeError` for a scale or move that puts a coordinate past the double range or makes it `NaN`, where it wrote `NaN` or `Infinity` into the path, which no SVG reader draws and which it could not read back itself. A coordinate past 1e306 is written as itself rather than overflowing to `Infinity` on the way to two decimals.
