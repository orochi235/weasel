---
"@weasel-js/ui-logic": patch
---

A tiling's `columns` is held to at most 2^24. `tileRows` and `tileKey` gave no rows for an `Infinity` column count, so the arrows went nowhere; `tileGrid` overflowed the stack on one with a stretched last row, and gave `Infinity` tracks for a count near the double range.
