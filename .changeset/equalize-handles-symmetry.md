---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

Double-clicking a balance grip to equalize a segment's handles now moves every image of both handles under a `pathSymmetry` dep, as dragging the grip already did; it used to change only the clicked segment and leave a symmetric path lopsided. `equalizeSegmentHandles` takes the symmetries as an optional fourth argument.
