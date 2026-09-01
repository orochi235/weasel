---
"@weasel-js/core": patch
---

Tell an event handler how late its crossing is

`EventTrack`'s `fire` took no arguments, so a handler could only ask its own
clock for "now" — when the frame was processed, not when the playhead crossed
the edge. That held footstep scheduling in the side-scroller at frame
resolution against an audio engine built for sample resolution: a measured peak
spread of 33–47 ms on the looping run cycle.

`fire(lateBy)` reports the gap between the crossing and the frame carrying it,
in timeline ms. It is never negative, including on the loop seam, where the
outgoing lap's tail fires after the playhead has already wrapped — the case
that makes a handler comparing against `handle.time()` read a negative
lateness. A nested timeline's events report the same figure as a top-level
one's; the track's offset cancels.

Nothing has to change to compile: a zero-argument function is assignable to the
new signature.

`lateBy` is a delta, not a clock reading, so events from two different
timelines still cannot be ordered against each other. That would need the
animator's virtual clock made public, which this does not do.

`SideScrollerDemo` now places each footfall a fixed budget after its true
crossing, so which frame happened to notice a contact turns into constant
latency rather than audible spread.
