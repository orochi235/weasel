---
'@weasel-js/stroke': patch
'@weasel-js/renderer': patch
---

An animating `Stroke.trim` no longer rebuilds the stroke's ribbon every frame. For an opaque solid stroke too large to batch, the renderer builds the ribbon once, untrimmed, with an arc length on every vertex, and the trim clips it in the shader, so a tween changes a uniform; only the cut ends, a few triangles with their caps, and the marker heads are built per frame. A trim tween on a 1,000-anchor path now makes no ribbon rebuild after its first frame. Other trimmed strokes are still rebuilt trimmed: translucent ones, ones the batch takes, ones built in a stretched view's metric, vertex-colored ones, and any paint but a solid. `@weasel-js/stroke` exports what the clip is built from: `clipRibbon`, which builds the ribbon, and `clipWindow`, which turns a trim into the window of lengths to draw and the geometry for its cut ends.
