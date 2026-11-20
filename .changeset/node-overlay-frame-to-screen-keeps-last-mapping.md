---
'@weasel-js/core': patch
---

`useNodeOverlayFrame`'s `toScreen` keeps the last invertible mapping once the node is gone, as `toLocal` does.

<!-- entry: fix -->
