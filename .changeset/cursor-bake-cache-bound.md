---
'@weasel-js/cursor': patch
---

`cursorFor` keeps the 512 most recently used baked cursors rather than every one ever asked for, so a cursor sized from a zoom or an animated value no longer grows memory without end.

<!-- entry: fix perf -->
