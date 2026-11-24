---
'@weasel-js/audio': patch
---

A voice released before its `when` is canceled with `onDrop('stopped')` every time, including inside the scheduler's lookahead, rather than sometimes playing its release tail.

<!-- entry: fix behavior -->
