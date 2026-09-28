---
"@weasel-js/paint": patch
---

`MarkerRef`'s docs now say what `size` does: a bare number is the marker unit in world units, replacing the stroke width rather than scaling with it. They previously claimed it scaled with the stroke width, which neither the renderer nor SVG export ever did.
