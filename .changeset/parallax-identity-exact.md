---
"@weasel-js/core": patch
---

`deriveParallaxView` with `pan: 1` and `zoom: 1` returns the camera's own view exactly, and `pan: 0` lands exactly on the anchor.

<!-- entry: rank=-5 fix -->
