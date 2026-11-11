---
"@weasel-js/symmetry": patch
---

A symmetry group reads a `data` field holding a value of the wrong type at its default, as a saved file can hold.

`specOfData` takes a kind only from `SYMMETRY_KINDS`' own entries, a cell only from the wallpaper cells, and an extent only as a box of numbers.

<!-- entry: fix data -->
