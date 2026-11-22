---
'@weasel-js/tiles': patch
---

A `TilePyramid` under a tight `maxBytes` settles, rather than rebaking the same tiles every frame.

It bakes only as much of the ring and the level above as the bound leaves room for.

<!-- entry: fix perf -->
