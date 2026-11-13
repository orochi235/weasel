---
'@weasel-js/geom': patch
---

A very wide stroke outlines in a fraction of the time, through `trianglesToPath`, `strokeToPath` and pdf's outlined strokes.

A round stroke a million wide on a path 200 across, about 3,500 triangles, now unions in under a second where it took minutes.

<!-- entry: perf -->
