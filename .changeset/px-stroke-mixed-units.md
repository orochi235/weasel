---
'@weasel-js/core': patch
---

Every part of a stroke is now built in the units its own size is given in, so each stays exact under a non-uniform transform.

- A `{ px }` stroke on outlined text is that many pixels wide in every direction, as a path's is; at a 4:1 view a 1px outline used to paint 2px across and half a pixel down. A glyph stroke's dashes are in the width's units — world, or screen pixels on a `{ px }` stroke — where they used to be read in em, so a dash pattern on text came out solid.
- A `{ px }`-sized marker head on a world-width stroke is that many pixels in every direction. It used to resolve through the mean scale and come out stretched.
- On a `{ px }` stroke, a head with a world size and every `vertexWidths` entry are world lengths, stretched by the view like any world geometry. They used to be read as lengths in the stroke's screen space. A head with no size still takes the stroke width.

Picking and culling follow each head's units: `NodeInk.outset` and `inset` carry what is built in world, `outsetPx` and `insetPx` what is built on screen, so a world-sized head on a `{ px }` stroke now reaches in `outset` and a `{ px }` head on a world-width stroke in `outsetPx`.
