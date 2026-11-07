---
'@weasel-js/minimap': patch
---

`computeIndicatorCommand` frames a flipped main view (y-up, or a mirrored x axis) as the world rect it shows, with a positive width and height, through core's `viewportWorldRect`. It used to emit the rect with a negative size, which a renderer reading the rect's corners as min/max took to be inverted.
