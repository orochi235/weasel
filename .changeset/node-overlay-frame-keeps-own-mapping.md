---
'@weasel-js/core': patch
---

A `useNodeOverlayFrame` frame's `toScreen` and `toLocal` keep their own node's last mapping once that node is removed, even after the hook has moved on to another node.

<!-- entry: fix -->
