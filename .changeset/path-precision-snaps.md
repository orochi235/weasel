---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Geometric snapping onto paths. `<SceneCanvas toolOptions={{ pathSnap }}>` makes the `snap` dep lock points to the scene's paths: where two strokes cross, the tangent and perpendicular points from where the line being drawn starts, segment midpoints, curve extremes and quadrant points, and the nearest point on a stroke. Each kind can be turned off in `pathSnap.kinds`, and `radius` is in screen pixels. The pen and every drag-to-insert tool get it ahead of `snapPoint`; a move snaps its base point, and an anchor drag the anchor, to the path targets alone. A marker layer draws a glyph and the kind's name on the snapped point; `marker: false` hides it. `SnapDep.point` now takes an optional `SnapQuery` (`origin`, `exclude`, `include`), and gains `toPaths` and `release`. The pen reads the `snap` dep when it is given no `snapPoint` of its own, which is how `<SceneCanvas>` now wires it.

Trim and Extend to Next Path. `useTrimTool` (key Y) hands a click to the new `trimPath` action, which removes the clicked piece of a stroke between the nearest crossings on either side. `extendToMeet` carries open ends along their tangent to the next stroke: the selection's ends, the selected end anchors in path edit, or with `useExtendTool` (key U) the end nearest a click. Both are in the standard actions and the `paths` feature.

`@weasel-js/geom` adds what these stand on: `intersectSegments`, `pathSegments`, `pathCrossings`, `createPathSnapIndex` and `findPathSnap`, `trimPathAt`, and `extendToMeet`, `lengthenOpenEnd`, `openEndRay` and `openPathEnds`.
