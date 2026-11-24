---
'@weasel-js/geom': patch
---

`pathFaceArrangement` throws a `RangeError` for a `flattenTolerance` too fine to flatten within 1024 chords a segment, and names the finest it can honor.

<!-- entry: fix behavior -->
