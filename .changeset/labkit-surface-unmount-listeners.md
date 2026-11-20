---
'@weasel-js/labkit': patch
---

A tiled surface stops listening for scrolls and density changes when its owner unmounts, without `containerRef(null)`.

<!-- entry: fix -->
