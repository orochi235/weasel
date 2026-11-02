---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/animator': patch
'@weasel-js/diagram': patch
'@weasel-js/stroke': patch
'@weasel-js/path-tools': patch
'@weasel-js/guides': patch
---

`@weasel-js/geom` states the nearest point of a segment, point distance and lerp once, in any
dimension, and every tier answers through that one rule.

- `@weasel-js/geom/nd` adds `segmentT`, `closestPointOnSegment`, `pointSegmentDist`,
  `pointSegmentDist2`, `distance`, `distance2` and `lerp` over plain number arrays.
- The root barrel adds `segmentT` and `pointSegmentDist` over loose scalars, which allocate nothing,
  beside the existing `pointSegmentDist2`; `distance`, `distance2` and `lerpPoint` over `Point`; and a
  scalar `lerp`.
- `@weasel-js/geom/3d`'s `closestPointOnSegment` and `lerp` now go through the same rule, so a planar
  problem gets the same numbers in 2D, 3D and `nd`.

A segment's parameter is clamped to [0, 1] and is 0 on a zero-length segment; at `t = 1` the nearest
point is the far end exactly. `nearestOnLine` and the private copies in core's measurement hit test,
animator's auto-skinning, diagram's route and label code, stroke's edge test, path-tools'
extend-to-meet and guides' layout snaps now call these, so their distances can move by a rounding
step (`Math.hypot` became a square root of the summed squares).

Corner shapes (`cornerShapePieces`) now fit the true superellipse within `CORNER_FIT_TOLERANCE` for
every finite `k`. Past `|k| ≈ 9` they strayed up to nine times the tolerance off the curve's straight
legs, because the fit stepped in an angle that crowds those legs into less than a double resolves;
it now steps evenly along each leg. The same corners draw with about a third fewer cubics.
