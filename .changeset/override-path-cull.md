---
'@weasel-js/core': patch
---

A culled scene view paints a path node shown by a pose override's `path` wherever that path is, not only where its stored pose is.

`PaintBoundsFn`'s `ctx` can carry that path as `derivedPath`, and `defaultPaintBounds` measures it.

<!-- entry: fix -->
