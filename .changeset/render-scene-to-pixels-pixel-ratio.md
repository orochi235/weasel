---
'@weasel-js/core': minor
---

`renderSceneToPixels` and `planPixelRender` take a `pixelRatio`, output pixels per CSS pixel.

A `{ px }` length renders at that many output pixels, as on a canvas at that density, and `scale` stays output pixels per scene unit. A plan made at a ratio other than 1 carries the `screen` it was made for, which `renderPlan` uses when given none.

<!-- entry: api -->
