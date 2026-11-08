---
'@weasel-js/geom': patch
'@weasel-js/stroke': patch
---

Fixes from a second audit of the geometry kernel and stroking, on degenerate input:

- `intersectSegments` reports where two collinear lines overlap when their points only round onto one line; it reported one crossing at an arbitrary place along them about a third of the time. A cut that doubles back along its own line no longer closes a degenerate loop when splitting a path.
- `intersectRayAabb` and `Bvh.raycast` miss every box along a ray with a NaN component, as `intersectRayPlane` does; they hit every box at t = 0.
- A length table measures a straight segment with a non-finite point as no distance, as it already measured such a curve; one bad point made the whole path's length NaN.
- `resamplePath` reads a count that is not a finite number as no count; NaN dropped every anchor after the first, and Infinity never finished.
- A dash offset that lands exactly on a zero-length dash draws its dot at the line's start, as the dash does anywhere else along the line.
