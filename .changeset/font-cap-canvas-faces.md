---
'@weasel-js/font': patch
---

The canvas font tier keeps at most 256 faces, so a weight tween or families typed into a font field no longer grow its memory.

<!-- entry: fix perf -->
