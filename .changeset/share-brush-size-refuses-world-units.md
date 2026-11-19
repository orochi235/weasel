---
'@weasel-js/brush': patch
---

`shareBrushSize` throws for an empty key, and for a size in another unit than screen pixels under `BRUSH_SIZE_PX`.

A brush sized in world units passes a key of its own: `shareBrushSize(OPTS, 'brushSizeWorld')`.

<!-- entry: fix -->
