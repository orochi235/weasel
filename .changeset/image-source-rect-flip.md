---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

A `kit:image` node can crop and mirror its bitmap. `data.image` takes an
optional `source` — the part of the bitmap to draw into the pose rect, as
fractions of the bitmap's width and height — and optional `flipX` / `flipY`,
which mirror the drawn region within the rect without moving it. The painter
hands both to the renderer's existing `ImageDrawCommand` fields, so hit-testing
and the silhouette are unchanged. Existing image data draws as before.

`svgNodesToKitDrafts` now carries an `SvgImageNode`'s source rect and flips onto
`data.image` instead of dropping them, and the new `svgImageFromKit(image, pose)`
writes a `kit:image` leaf back as an `SvgImageNode`, so a cropped or flipped
image survives SVG → scene → SVG.
