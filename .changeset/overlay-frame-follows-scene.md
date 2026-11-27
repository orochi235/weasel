---
'@weasel-js/core': patch
---

`useNodeOverlayFrame` re-renders when the scene or a pose override changes. An overlay follows its node through an edit, a drag preview, or its removal even when nothing else re-renders its component.

<!-- entry: fix -->
