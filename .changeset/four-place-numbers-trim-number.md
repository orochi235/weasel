---
'@weasel-js/geom': patch
'@weasel-js/diagram-formats': patch
---

`trackShapeD` and the draw.io writer write a non-finite coordinate as `0`, not `NaN`, as the SVG writer does.

Both now write their four-place numbers through `trimNumber`.

<!-- entry: fix data -->
