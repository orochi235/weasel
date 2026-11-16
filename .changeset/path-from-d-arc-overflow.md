---
'@weasel-js/geom': patch
---

`pathFromD` ends a path before an arc holding a number past the double range, with a warning, rather than dropping the arc silently.

<!-- entry: fix -->
