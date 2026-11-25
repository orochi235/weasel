---
'@weasel-js/cursor': patch
---

`cursorFor` keeps the 512 most recently used baked cursors, so a cursor sized from a zoom or an animation no longer grows memory without end.

<!-- entry: fix perf -->
