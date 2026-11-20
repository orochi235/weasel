---
'@weasel-js/geom': patch
---

`pathToAnchors` turns a quadratic into the cubic tracing the same curve, so an anchor edit no longer bulges a path's `Q` segments.

<!-- entry: fix visual -->
