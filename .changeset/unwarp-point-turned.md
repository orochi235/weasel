---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

Add Pin places the pin on a pin-warped shape turned past 60°, since `unwarpPoint` now inverts such a warp.

It now steps through the map's local Jacobian and returns the point with the smallest miss it found.

<!-- entry: fix -->
