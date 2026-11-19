---
'@weasel-js/geom': patch
'@weasel-js/diagram-formats': patch
---

`trackShapeD` and the draw.io writer write their four-place numbers through `trimNumber`, so a non-finite coordinate writes `0` rather than `NaN`, as the SVG writer's do.

<!-- entry: fix data -->
