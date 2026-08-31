---
'@weasel-js/core': patch
---

A drag-to-insert reports the bounds it paints

The painter, the commit factory and `getGestureBounds()` each sized an
in-flight insert differently. The reporter read the drag rect alone, so a
centered Alt-drag reported a half-extent of `d` against a painted circumradius
of `d√2`, a purely horizontal Alt-drag reported **height 0** for a visibly tall
star, and a pencil scribble that looped back to its start reported nothing at
all. The painter and the commit agreed on polygon and star but not on line or
pencil: the commit posed the drag AABB for a line the painter drew endpoint to
endpoint, and fell back to the drag rect for a trail under four samples.

One function now answers it for all three. The zero-area skip in the painter
and the reporter tests the resolved extent rather than the raw drag rect, and
an `InsertNodeFactory` that returns no `pose` falls back to the extent. The
`bounds` argument handed to a factory is unchanged.
