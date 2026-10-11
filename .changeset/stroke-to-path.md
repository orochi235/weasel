---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

`strokeToPath(path, stroke)` returns the region a stroke covers as a fillable path: width, cap, join, miter limit, dash, alignment, per-vertex widths, and marker heads all included, with self-overlaps resolved. `trianglesToPath` in `@weasel-js/geom/booleans` is the union of a triangle mesh it is built on. Both are additions.
