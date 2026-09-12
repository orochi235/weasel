---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

`@weasel-js/geom` is now the single definition of the geometry both packages
were carrying, and `@weasel-js/core` imports it.

Two of core's command-stream walks had the pen wrong after a `Z`: `boundsOfPath`
measured a following curve from the last point drawn rather than the subpath
start, and `extractPolylines` flattened one from there. Both are fixed by
`forEachSegment`, which now returns the pen where SVG says `Z` leaves it, and
which also reports the command index and stops when its visitor returns `false`
— the three things core's own walks needed. Ten walks, six Bernstein
evaluations, an even-odd ray cast and four rect-corner literals now go through
geom.

`pathPoseDescriptor.remapBounds` scaled a zero-extent source axis by `0`, which
collapsed a flat path onto the destination origin and left a transform that
could not be inverted. It uses geom's `boxToBox`, which translates that axis, as
`scalePathToBounds` already did.

Moved into geom so core no longer keeps a second copy: bezier flattening
(`flattenQuadratic` and both arc-length variants included) and `pathCrop`.
geom's boolean adapter picks up core's ring nesting, which pre-tests bounding
boxes and votes over three sample vertices where geom probed one — a hole
sharing a vertex with its container was misclassified.

`rectToContour` now emits the four corners with the closing edge implicit,
matching what `pointInPolygon` documents and what every call site wants. The
repeated first vertex it used to emit is a zero-length closing segment for
anything that strokes the result.
