---
'@weasel-js/ui': patch
---

Fixes: a `Badge` on the `quatrefoil`, `octant-spline`, `octant-bspline`, or `puzzle` base kept its content inside the base's own outline, but not inside one that a negative `bloat` or an effect such as `bites` or `scallops` had pushed inward. The insets now keep the content clear of the base outline by as far as `bloat` and the effects move any part of it inward, rounded up to half a pixel, so such a badge is larger than it was. One with no `bloat` and no inward effect, or with only an outward one, is the size it was.
