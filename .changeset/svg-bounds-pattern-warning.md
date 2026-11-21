---
'@weasel-js/svg': patch
---

`serializeSvg` warns when it writes a pattern fill in `'bounds'` units, which SVG places at the user-space origin, not on the shape's box.

Resolve such a paint with `paintToLocalUnits` before serializing it; the kit's own SVG export already does.

<!-- entry: fix -->
