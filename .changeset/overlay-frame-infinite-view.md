---
'@weasel-js/core': patch
---

`useNodeOverlayFrame` has no frame under a view scaled to infinity on an axis, and its `toScreen` and `toLocal` keep the last finite mapping while a live view is, rather than mapping every point to infinity.

<!-- entry: fix -->
