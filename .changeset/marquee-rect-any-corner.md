---
"@weasel-js/core": patch
---

A marquee rect with a negative width or height selects what the same rect named from its other corner selects.

`hitTestArea` and `rectRegion` read such a rect as reaching back from `x` or `y`, as a drag up and to the left does.

<!-- entry: fix -->
