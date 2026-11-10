---
"@weasel-js/geom": patch
---

Path booleans no longer throw `Unable to complete output ring` when two inputs have vertices a rounding error apart, such as a float32 polygon corner beside the same corner of a rect in doubles. When `polygon-clipping` throws, the operation is rerun with coordinates snapped to a grid scaled to the inputs, finest first and never coarser than the kernel's `EPS`.
