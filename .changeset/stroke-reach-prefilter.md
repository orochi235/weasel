---
'@weasel-js/core': patch
---

A thick stroke is clickable across its whole width

`shapeCoversPoint` grants a grab out to a stroke's outward reach — a full
stroke width for an `outer` align — but the AABB pre-filter that runs before it
grew only by the pointer slop. So half a thick outer stroke's ink was
unclickable: the point was rejected before the refinement that would have
claimed it ever ran. `poseContains` carried a comment claiming the pre-filter
was at least as generous as the refinement, which it cannot be on its own,
since it never sees the stroke. That budget is the caller's, and the comment
says so now.

`ShapeCoversPointOptions.scale` was never passed either, so a stroke width
declared in `px` resolved as world units and the reach was wrong at every zoom
but 1 — while the caller computed `meanScale(view.scale)` one line above.
