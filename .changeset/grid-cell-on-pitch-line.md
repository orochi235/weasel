---
"@weasel-js/guides": patch
---

`pointToGridCell` and `cellOf` put a point lying on a pitch grid's line in the cell above that line even when floating point division lands just under it (0.3 on a 0.1 grid), as they already did for a grid of explicit lines.
