---
'@weasel-js/geom': patch
---

When a polygon boolean has to retry on snapped coordinates, its coarsest snap no longer merges vertices that are distinct in float32.

<!-- entry: rank=-1 fix -->
