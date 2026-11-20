---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

Sand and `simplifyAnchorsAt` leave a closed subpath starting on the anchor it started on, so its dash phase and the seam set with `setSubpathStart` stay put.

<!-- entry: fix -->
