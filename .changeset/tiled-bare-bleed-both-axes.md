---
'@weasel-js/parallax': patch
---

A bare-number `bleed` on `createTiledLayer` covers both axes, so content tiled in y scrolls in at the top and bottom edges.

A lattice tiled on x alone draws as before. Pass `bleed: { x: n }` to widen x only.

<!-- entry: fix visual -->
