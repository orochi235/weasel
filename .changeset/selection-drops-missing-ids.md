---
"@weasel-js/core": patch
---

A scene's selection never holds an id that names no node, including one an undo puts back after an untracked edit removed that node.

<!-- entry: fix -->
