---
'@weasel-js/core': patch
'@weasel-js/guides': patch
---

A stroked shape's box now includes its stroke as drawn, engine-wide. The selection outline and handles sit on the stroke's outer edge (align, joins, markers, variable widths, and screen-pixel widths at the view's scale all counted), and a group's box reaches as far as its members' strokes. Resizing moves that box and keeps the stroke's width, so the stroke's outer edge lands under the pointer: a 100×100 rect with a centered stroke 10 wide shows a 110×110 box at (−5, −5), and dragging its right handle to x = 205 leaves the rect 200 wide. Resize constraints see the box with the stroke. Rotate turns a selection about the center of that box, and flip, align, distribute, and alignment snapping measure it too. Stored geometry is unchanged: a group's derived pose, booleans, outlines, and export still read the pose box.

This changes behavior for any stroked shape. `<SceneCanvas geometry={{ boundsIncludeStroke: false }}>` restores geometric boxes; actions read it as the new `boundsIncludeStroke` dep.

New in core: `drawnBoundsOf`, `drawnAABBOf`, and `inkExtentsOf` answer the box for any scene node, and `NodeShapeEntry.drawnBounds` lets a painter report its own (the built-in shape and path painters measure miter joins and markers on polygons, stars, and paths). `GestureFrames.drawnBounds` hands that box to gesture behaviors. `SceneCanvasGeometry` names the `geometry` prop's type. A variable-width stroke's picking reach now uses its widest vertex.

`@weasel-js/guides`: pass `drawnAABBOf` boxes to `deriveAlignmentGuides` so siblings are measured the same way as the dragged selection.
