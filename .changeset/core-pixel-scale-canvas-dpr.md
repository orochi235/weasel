---
'@weasel-js/core': patch
---

An image node's SVG rasterizes at the density its canvas paints at (a `dpr` prop, `renderSceneToPixels`' scale), not the window's.

<!-- entry: fix visual -->
