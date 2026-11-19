---
'@weasel-js/brush': patch
---

A brush tool given `shareBrushSize(…)` in a render is no longer redefined on every render.

`shareBrushSize` now returns the same frozen share for the same size option and key.

<!-- entry: fix -->
