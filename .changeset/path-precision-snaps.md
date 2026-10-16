---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Geometric snapping onto paths. `<SceneCanvas toolOptions={{ pathSnap }}>` makes the `snap` dep lock points to the geometry of every node on a visible, non-annotation layer: its drawn outline (`nodeOutline`) and, for a painter marked `snapsToBox` (text and images), its pose box and the box's center. The targets are anchors and corners, box centers, where two strokes cross, the tangent and perpendicular points from where the line being drawn starts, segment midpoints, curve extremes and quadrant points, and the nearest point on a stroke. Each kind can be turned off in `pathSnap.kinds`, and `radius` is in screen pixels.

The pen and every drag-to-insert tool get it ahead of `snapPoint`, so a consumer's grid or measurement-end rule still applies wherever no path target is in range. A move snaps its base point, and an anchor drag the anchor, to path targets alone; an anchor drag also snaps to its own path's other anchors and segments, leaving out the segments it moves (`SnapQuery.also`). A marker layer draws a glyph and the kind's name on the snapped point; `marker: false` hides it.

`SnapDep.point` now takes an optional `SnapQuery` (`origin`, `exclude`, `include`, `also`), and gains `toPaths` and `release`. The pen reads the `snap` dep when it is given no `snapPoint` of its own, which is how `<SceneCanvas>` now wires it.

`@weasel-js/geom` adds `createPathSnapIndex`, `findPathSnap`, `PATH_SNAP_KINDS`, and `pathAwayFromAnchors`.
