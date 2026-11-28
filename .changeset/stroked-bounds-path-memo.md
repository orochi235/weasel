---
'@weasel-js/core': patch
---

Snapping no longer re-tessellates the stroke of a path-posed or derived node that has not changed. The drawn box is kept until its path, stroke, or view changes.

<!-- entry: perf -->
