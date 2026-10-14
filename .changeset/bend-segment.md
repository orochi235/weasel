---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

In path edit, dragging a segment bends it: the point pressed follows the pointer and the segment's two handles move to carry it, and a straight segment becomes a curve. An end anchor that was smooth stays smooth, its other handle turning at its own length. It is the `bendSegment` action, in the standard actions and the `paths` feature preset. A drag that starts on an anchor or off the path still moves anchors or draws the marquee, and on a canvas with no mode registry a drag that starts on the edge no longer moves the shape.

Path edit now lays a `segment` affordance along the edited path's outline, under its anchors and controls, and `bendSegment` binds to it. Affordance regions take a new shape for it, `{ kind: 'outline', path, hitRadiusPx }`: hit within that many screen pixels of the path's outline. `@weasel-js/routing` adds `isSegment` for that hit and `isPathEditPart` for any anchor, control, or segment hit; `move` turns down a press on any of them.

`bendSegment(set, grip, dx, dy)` (`@weasel-js/geom`) is the edit underneath, taking the `{ sub, segIdx, t }` that `segmentAt` reports.
