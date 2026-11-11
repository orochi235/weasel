---
"@weasel-js/core": patch
---

`deriveParallaxView` with `pan: 1` and `zoom: 1` returns the camera's own view exactly, as its documentation says, and `pan: 0` lands exactly on the anchor. Rounding used to leave such a plane an ulp off the camera, so its `planeMap` was never the identity.
