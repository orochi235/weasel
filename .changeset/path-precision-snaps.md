---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Geometric snapping onto paths. `pathSnapSource()` offers the geometry of every node on a visible, non-annotation layer as snap targets: its drawn outline (`nodeOutline`) and, for a painter marked `snapsToBox` (text and images), its pose box and the box's center. The targets are anchors and corners, box centers, where two strokes cross, the tangent and perpendicular points from where the line being drawn starts, segment midpoints, curve extremes and quadrant points, and the nearest point on a stroke. `kinds` turns each kind on or off and `only` names the ones offered. An anchor drag also snaps to its own path's other anchors and segments, leaving out the segments it moves. The snapped point is drawn with a glyph and its kind's name (`pathSnapGlyph`, `PATH_SNAP_LABELS`).

`@weasel-js/geom` adds `createPathSnapIndex`, `findPathSnap`, `findPathSnaps`, `PATH_SNAP_KINDS`, and `pathAwayFromAnchors`.
