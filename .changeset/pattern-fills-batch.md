---
'@weasel-js/renderer': patch
---

A pattern fill (`kind: 'texture'`) on a path, a stroke or an outline glyph now joins the renderer's batched run instead
of drawing for itself: its tile takes a texture slot in the run and each vertex carries its tile coordinate, so a
pattern no longer flushes the solids, gradients, images and text around it. What it paints is unchanged, opacity and
group color matrix included.
