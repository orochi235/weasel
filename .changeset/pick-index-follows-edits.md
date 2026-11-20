---
'@weasel-js/core': patch
---

A scene's pick index follows an edit, a drag or a scroll by updating the nodes it touched, not rebuilding once the scene holds still.

<!-- entry: perf -->
