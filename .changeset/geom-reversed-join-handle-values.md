---
'@weasel-js/geom': patch
---

Joining two subpaths at an end that turns one of them around keeps each handle's per-point values, such as skin weights, on that handle.

<!-- entry: fix -->
