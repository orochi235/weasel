---
"@weasel-js/core": minor
---

Chrome hit-tests are axis-aware under non-uniform zoom.

Chrome declares its hit zones in screen pixels and paints in screen space, but
the hit-test converted those pixels to world units through `meanScale`, a
single geometric mean of the two axis scales. Under per-axis zoom that made the
pickable region larger than the painted one on the squashed axis and smaller on
the stretched one — an 8px handle at `scale: { x: 4, y: 1 }` was grabbable 16
screen px to the side and only 4 px above.

New primitives in `core/viewport/pxExtent`, all exported: `pxExtent(px, scale)`
for a per-axis world length, and `withinPxBox` / `withinPxRadius` to compare a
world-space delta in screen space directly, which can't drift from the paint at
all.

`AffordanceRegion`'s `point` hit is now that screen-space comparison, so a
handle's hit region is the square you see — which also fixes it under a rotated
target, where the old local-frame test was a tilted rectangle on screen. The
annulus band floor (`minBandPx`) and the annulus paint inset (`insetPx`) are
per-axis, keeping the ring you can see the ring you can grab. The pen's
close-hit radius is a screen-space circle. Snap-guide tolerances — the shared
guide strategy, insert, resize, and alignment — are per-axis, which is exact
rather than approximate there: a vertical guide is matched by a horizontal
distance, so it answers to `scale.x` alone.

`matchAlignment`'s `worldTolerance` parameter is now `{ x, y }` rather than a
number. Pass the same value twice for a world-space tolerance.

`meanScale` stays, for the two things that legitimately have no per-axis
answer: hairline stroke widths, where the renderer takes one width, and painted
chrome placement, whose per-axis form doesn't separate under a rotated target.
Its doc now says so.
