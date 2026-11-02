---
'@weasel-js/geom': patch
---

`clamp` now returns `lo` whenever `lo > hi`, as its documentation always said. It used to return `hi`
for any `v` above `lo` in that case. Inside normal bounds nothing changes, and `NaN` still passes through.

New exports from `@weasel-js/geom`:

- `clamp01(v)` holds `v` to `0..1`, and `NaN` passes through.
- `rectsOverlap(a, b)` tests two `{ x, y, width, height }` rects for shared interior, so rects that only
  touch answer false. `rectsIntersect(a, b)` counts touching edges and corners.
- `boxesIntersect(a, b)` is `rectsIntersect` for `[minX, minY, maxX, maxY]` boxes.
- `rectContainsPoint(r, x, y)` counts every edge as inside. `rectContainsPointHalfOpen(r, x, y)` leaves
  the right and bottom edges outside, so rects that tile a plane never both claim a point.
- `unionRects(rects)` gives the smallest rect around any number of rects, or `null` for none.
- `ringSignedArea(coords, start?, end?)` gives the signed shoelace area of a flat, unclosed ring. It is
  positive when the ring runs counterclockwise with y up.

Core, kernel3d, ui, svg, renderer, diagram, guides and path-tools now use these instead of their own
copies, and each replaced copy returns what it did before.
