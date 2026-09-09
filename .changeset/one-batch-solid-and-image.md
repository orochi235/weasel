---
"@weasel-js/core": patch
---

Solid geometry and image quads now share one batch, so a wall of thumbnails —
a ground rect under an atlas quad, per cell — draws in one call rather than
one per command. The two batches used to be exclusive: staging a solid drained
the image run and staging an image drained the solid one, so a shape that
batches perfectly in either half alone paid a flush per command. Solid vertices
carry the UV of a 1x1 white texel, which makes `texture() * a_vertexColor` the
vertex color exactly, so the merge is pixel-identical rather than close.

Measured over a viewport-filling grid of those cells on an M2 Max via ANGLE
(`tests/perf/atlas-wall.spec.ts`): 600 draw commands 2.83 -> 0.10 ms, 1,650
11.37 -> 0.20, 5,400 40.50 -> 0.58, 15,000 126.15 -> 1.50. A run still breaks
on what a run cannot carry — a second bitmap, a different MAG_FILTER, a clip
depth, a color matrix.
