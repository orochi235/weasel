---
'@weasel-js/renderer': patch
'@weasel-js/stroke': patch
---

An animating stroke trim no longer rebuilds a translucent, vertex-colored, gradient- or pattern-painted stroke too large to batch, nor any stroke's marker heads. Such a stroke is clipped from its one cached ribbon in the shader, as an opaque solid one already was, and paints each pixel once through the stencil, so it does not darken where its ribbon turns. Heads are built once and drawn under the transform that places them, so a trim only moves them. A head's own paint (`MarkerEntry.fill` or `outline.paint` other than `'line'`) is now resolved against the head's unplaced box and turns with the head, as a node's box paint turns with the node, where it was resolved against the placed head's axis-aligned box.

`@weasel-js/stroke` adds `markerPlacements`, `markerShape`, `markerPlacementMap` and `markerPolylines`, which say where each head goes without building it.
