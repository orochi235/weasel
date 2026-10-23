---
"@weasel-js/geom": patch
"@weasel-js/ui": patch
---

`Jog` follows a curve. Inside an `Along`, or given a curved `shape`, its step and play buttons, readout and caption lie along the shape in reading order, each tipped to it, and the scrubber bends along the stretch of the run they leave between them, keeping at least 80 px. Without a scrubber the controls sit where the `Along`'s `align`, or Jog's own `align`, puts them. On a straight line it is the row it always was.

In geom, `trackSlice(shape, from, to)` cuts a stretch of a track shape out as a shape of its own, running the same way: an arc stays an arc and an ellipse an ellipse, so `trackShapeD` still draws it with true arcs.
