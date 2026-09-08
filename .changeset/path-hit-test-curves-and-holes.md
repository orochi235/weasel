---
'@weasel-js/core': patch
---

`pathHitTest` reads curves and holes instead of throwing on one and ignoring
the other.

Its vertex extractor walked `M` and `L` only and threw on any bezier command,
and it stopped at the first `Z`, so a path's second contour was never
considered. The throw was reachable in ordinary use: `sceneAdapter`'s
`nodeBoundsPassClips` calls `pathIntersectsRect` on every ancestor clip, so a
container with a curved `clipFromPose` crashed the hit-test walk.

`pathContainsRect`, `pathIntersectsRect`, `pathContainsPolygon` and
`pathIntersectsPolygon` now treat a `PolygonPath` as its filled region. Whether
a point is inside comes from `pointInPath`, so beziers flatten and `fillRule`
decides — a donut's hole is outside the shape under `evenodd` and inside it
under `nonzero`, and the four predicates agree with `pathContainsPoint` on
which. Each takes the same optional flattening tolerance `pointInPath` does.

Two answers change for paths that already worked. A rect sitting in a hole is
no longer reported as contained or intersecting, and containment now fails when
a contour reaches into the rect at all rather than only when it crosses an
edge.
