---
'@weasel-js/core': patch
---

A pan coast started with a `NaN` or infinite velocity ends at once and calls `onEnd`, rather than writing a non-finite pan every frame.

<!-- entry: fix -->
