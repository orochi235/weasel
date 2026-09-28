---
'@weasel-js/labkit': patch
---

Moving or resizing an annotation now carries its drawn geometry with it. A point, line, arrow or freehand mark used to keep drawing at its original place after `update({ frac })` or a drag in the pane moved its bounds, while clicks were picked at the new place. A mark's vertices are now stored in `AnnotationData.shape` as fractions of its own bounds, so there is one position to move; `Annotation.points` still reads back in the target's content box, and a point mark's position is its bounds. `update({ points })` without `frac` now moves the bounds to enclose the new points. Saved documents that stored `points` are converted when they load.

Breaking: `markCommands` and `markSvgNodes` no longer take a content box, since geometry is placed from the pose alone — drop the second argument. `AnnotationData.points` is now `AnnotationData.shape`.
