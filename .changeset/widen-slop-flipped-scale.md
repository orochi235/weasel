---
'@weasel-js/core': patch
---

Picking near a stroke's ink edge reaches as far on a flipped (y-up) view as on an unflipped one. `widenSlop` reads a negative scale by its magnitude.

<!-- entry: fix -->
