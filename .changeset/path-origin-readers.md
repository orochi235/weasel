---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/path-tools': patch
'@weasel-js/diagram': patch
'@weasel-js/animator': patch
'@weasel-js/rig': patch
---

Every reader of a `PolygonPath`'s coords now reads them where its `origin` puts them: hit-testing and marquee/lasso picking, distance, anchors (`pathToAnchors`, anchor editing, corner expansion and restore), the booleans, `pathToD` and SVG export, cubic contours, puppet meshes, pose interpolation, derived parts, path warps, diagram connectors, and skinning. `translatePath` and `rotatePathAround` move the origin rather than the coords, and `anchorsToPath` given `like` writes back from its origin. This adds API: `worldCoords`, `pathPoint`, `originOf`, `addOrigin` and `coordsFrom` read and write coords in a path's own space.

Paths far from 0 now get an origin where they are made: past `ORIGIN_THRESHOLD` (16,384), `anchorsToPath` without `like` (the pen tool), `pathFromD`, the booleans, and SVG import measure the path from `originFor`, the rounded center of its points. `PathBuilder.autoOrigin()` and `transformPath`'s `{ autoOrigin: true }` opt a producer in. A path near 0 is built as before.
