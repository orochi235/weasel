---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A `Slider` given a line `shape` now lies where the line's ends say, as it does along an arc or an ellipse; before,
a line kept the straight layout and its coordinates were ignored. `TrackCtx` gains `along`, set when the slider
lies along a shape, and `paintGradientTrack` strokes the band whenever it is, so a line shape is painted along
the line. A track painter that told a curve from a line by `shape.kind` should read `along` instead.

A press on a lens's rim zoom now makes the lens canvas the one the keys reach, and gives its input element focus
when the press ends, so Cmd+Z undoes the zoom at once; before, it went to whatever had been pressed last.
The arrow keys on a thumb reached by Tab keep focus there. A square body's zoom is a line track across its bottom,
inset from the edges as a round body's arc is.
