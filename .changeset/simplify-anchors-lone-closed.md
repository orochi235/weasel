---
'@weasel-js/geom': patch
---

`simplifyAnchorsAt` and `simplifyPath` leave a closed subpath of one anchor, or of anchors all on one point, as it was, instead of emptying it.

<!-- entry: fix -->
