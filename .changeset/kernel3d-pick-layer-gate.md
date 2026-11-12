---
"@weasel-js/kernel3d": patch
---

A click or a marquee in a 3D view no longer selects a node on a layer that view does not paint.

`createPickEvery` and `createAreaSelect` now read the asking view's `layerIsPainted`, as core's own picks do.

<!-- entry: fix -->
