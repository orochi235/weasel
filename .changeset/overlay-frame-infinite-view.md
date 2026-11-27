---
'@weasel-js/core': patch
---

`useNodeOverlayFrame` has no frame under a view scaled to infinity. While a live view is, `toScreen` and `toLocal` keep the last finite mapping rather than mapping every point to infinity.

<!-- entry: fix -->
