---
'@weasel-js/ui': patch
---

`SwatchGrid` and `SwatchStrip` now honor `align` in their flat grid layout, not only on a curved shape: a last row
with fewer swatches than columns sits at the start, center, or end of its row. The flat default stays `'start'`, so a
grid that sets no `align` looks as before; inside an `Along` it follows the `Along`'s. ArrowUp and ArrowDown move to
the swatch over or under the focused one in a shifted row.
