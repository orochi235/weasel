---
'@weasel-js/geom': patch
---

Deleting anchors keeps a lone point elsewhere in the path, and a deletion that leaves only such a point goes ahead instead of being refused.

<!-- entry: fix -->
