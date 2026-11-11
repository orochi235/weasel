---
"@weasel-js/geom": patch
---

Path booleans no longer throw `Unable to complete output ring` when two inputs have vertices a rounding error apart. When `polygon-clipping` throws, the operation reruns with coordinates snapped to a grid scaled to the inputs, finest first and never coarser than the kernel's `EPS`.

<!-- entry: fix -->
