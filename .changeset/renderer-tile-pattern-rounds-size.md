---
'@weasel-js/renderer': patch
---

`createTilePattern` rounds a fractional `size` to whole pixels and hands `draw` the rounded size, so a tile repeats at the period its canvas holds.

<!-- entry: fix visual -->
