---
'@weasel-js/renderer': patch
---

Where there is no `OffscreenCanvas`, `createTilePattern` returns `null` without creating a canvas or calling `draw`.

<!-- entry: fix perf -->
