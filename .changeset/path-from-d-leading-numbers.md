---
'@weasel-js/geom': patch
---

`pathFromD` draws nothing, and warns, for path data with numbers or punctuation before its first command, as SVG renders it.

<!-- entry: fix -->
