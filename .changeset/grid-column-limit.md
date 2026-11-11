---
"@weasel-js/ui-logic": patch
---

A tiling's `columns` is held to at most 2^24, so `tileRows`, `tileKey` and `tileGrid` work for an `Infinity` or huge column count.

<!-- entry: rank=-5 fix -->
