---
'@weasel-js/geom': patch
---

`pathFromD` stops at numbers after a closepath (`Z 5 5`) and warns, as SVG does, instead of drawing the commands after them.

<!-- entry: fix visual -->
