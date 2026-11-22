---
'@weasel-js/core': patch
---

A tiled layer bakes a tile too costly for one frame in parts over several, its stand-in showing until the tile is whole.

Each part is a square of the tile, culled and clipped to it, sized from what that level's bakes have cost. With the coarser-tree pruning, the slowest frame of `tile-zoom.spec.ts` after the first went from 117.665 ms to 18.190.

<!-- entry: fix perf -->
