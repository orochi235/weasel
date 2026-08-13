---
"@weasel-js/core": patch
---

Dragging a text node no longer re-lays it out.

`layoutRuns` baked the text's position into every quad, decoration rule and
line box, so `layoutCache` had to carry that position in its key. Panning and
zooming still hit the cache, but *moving* a text node missed on every frame —
at 500 wrapped glyphs a move cost 0.130 ms against a 1.7e-4 ms hit, which is
the same 0.134 ms a full miss cost. Moving text paid as if there were no cache
at all.

Layout now emits geometry relative to the text's own top-left and `drawText`
translates while packing vertices, alongside the `verticalAlign` offset it
already applied there. Position is out of the cache key, so a move is a hit:
median 0.130 ms → 0.000125 ms, min 0.123 ms → 0.000041 ms. The cold path is
unchanged (min 0.123 ms → 0.110 ms for a full miss).

This is not a rendering change. Alignment, wrapping, tracking, kerning and
decoration placement read widths and pen deltas, never an absolute coordinate,
and nothing in the walk rounds or snaps — checked over 247,572 coordinates
spanning three alignments, four wrap widths, mixed sizes, positive and negative
tracking, and fractional positions. The only differences were float64 rounding
from folding the position into the accumulator early, none of them survived the
conversion to the float32 vertex buffers, and they favor the new code: at a
position of 1e6 the old path computed 28.800000000046566 where this one gives
28.8. The 37-test Playwright visual suite is unchanged.

`layoutRuns` and `cachedLayoutRuns` lose their `origin` parameter, and the
`LayoutRunsOrigin` type is gone. Neither is exported from the package. Callers
of the public `textLineBoxes` and `measureTextBounds` see no change.
