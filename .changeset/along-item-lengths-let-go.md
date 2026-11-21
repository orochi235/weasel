---
'@weasel-js/ui': patch
---

A curved row forgets the measured length of an item once it is gone from the row, so a long session of added and closed tabs no longer grows its work on every render.

<!-- entry: fix perf -->
