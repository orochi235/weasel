---
'@weasel-js/geom': patch
---

Booleans on straight-line paths with overlapping contours honor the path's fill rule. An even-odd overlap, or one between opposite windings, stays empty, as with curves.

<!-- entry: fix -->
