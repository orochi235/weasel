---
'@weasel-js/export': minor
---

`selectionRegion` takes the export's `scale`, so a selection exported below scale 1 keeps its screen-pixel strokes whole.

The third argument is now a name or `{ name?, scale? }`: `selectionRegion(scene, ids, { scale: 0.5 })`.

<!-- entry: api fix -->
