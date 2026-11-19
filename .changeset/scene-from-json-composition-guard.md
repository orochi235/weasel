---
'@weasel-js/core': patch
---

`loadScene` and `loadState` refuse a nested pose the default rect composition cannot fold, saying to pass the composition.

A 3D scene loads with `loadScene(json, { composition: POSE3_COMPOSITION })`.

<!-- entry: rank=5 fix data -->
