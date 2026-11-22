---
'@weasel-js/tiles': patch
'@weasel-js/core': patch
---

A tiled layer rebakes tiles an edit or a deps change made stale once it holds still, even when nothing else asks for another frame.

A pyramid frame's `pending` now counts stale tiles still waiting out the frame they hold before rebaking.

<!-- entry: fix visual -->
