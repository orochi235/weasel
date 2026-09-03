---
"@weasel-js/core": patch
---

Fix the viewport primitives on an axis with negative scale.

`View.scale` is documented as pixels per world unit _per axis_, so `scale.y < 0`
is the ordinary way to spell a y-up camera. Two primitives did not read it that
way, and both failed silently rather than erroring.

`zoomAt` clamped the signed scale against positive bounds
(`min(max, max(min, scale * factor))`), so one wheel step on a y-up view
returned `scale.y = +0.1`: the axis flipped and the zoom collapsed to the
minimum. It now bounds the magnitude and restores the sign, so a clamp limits a
flipped axis instead of unflipping it.

`clampView` computed the visible world extent as `canvas.height / scale.y`,
which is negative on a flipped axis. That made the "is the view zoomed out past
the bounds" test never fire, and put the scroll interval on the wrong side of
the anchor — a y-up view could be panned outside its own bounds. It now takes
the extent as a magnitude and anchors the interval at the rect's far edge when
the axis is flipped.

Found while giving labkit's instrument canvas a declarable coordinate system:
routing its wheel through `zoomAt` looked like the obvious way to stop
reimplementing fixed-point zoom, and would have been a bug.
