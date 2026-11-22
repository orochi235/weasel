---
'@weasel-js/geom': patch
---

A closed two-point spiro contour from `spiroToPath` reads back closed in `spiroContoursOf`, so a third point keeps it closed.

<!-- entry: fix -->
