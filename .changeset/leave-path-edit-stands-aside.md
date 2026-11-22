---
'@weasel-js/path-tools': patch
---

Escape reaches the next binding when no path is open and no tool would change.

`leavePathEdit` now reports itself disabled then, so on a canvas with no mode registry Escape can reset the tool.

<!-- entry: fix -->
