---
'@weasel-js/stroke': patch
'@weasel-js/core': patch
---

New `strokeAtScale(stroke, scale)` in stroke resolves every `{ px }` length of a stroke at a view scale the way the renderer does: the width, each marker size, and the dashes of a `{ px }` width. `strokeToPath` now reads a `{ px }` stroke's dashes at its `scale` option, where it used to take them as world units. A node's stroked bounds, measured at a view scale without a screen map, now size a `{ px }` marker head at that scale instead of at 1.
