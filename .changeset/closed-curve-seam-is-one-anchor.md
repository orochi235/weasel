---
'@weasel-js/core': patch
---

A closed path whose last curve ends on its first point now has one anchor there. `pathToAnchors` and `enumerateAnchors` read that point as two anchors, one holding the out handle and one the in handle, so on any closed curve (an ellipse, a pen path closed on a curve) dragging the first anchor moved one of the pair and left a straight edge to the other, its handles never mirrored, and the overlay drew two stacked squares. Both now fold the closing curve's end into the first anchor, which carries both handles. `PathAnchor` gains `closeCoordIndex` for the point's second slot in `coords`, and `translateAnchor` moves both. `countPathAnchors` still counts one per command, since it sizes the renderer's per-anchor arrays.
