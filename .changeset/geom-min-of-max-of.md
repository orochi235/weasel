---
"@weasel-js/geom": patch
---

`@weasel-js/geom` adds `minOf` and `maxOf`, the least or greatest of a list of any length. Each answers as spreading the list into `Math.min` or `Math.max` does (`Infinity` or `-Infinity` for none, `NaN` for any `NaN`), but from a loop, so it never overflows the call stack, and optionally through a function of each item.

<!-- entry: new api -->
