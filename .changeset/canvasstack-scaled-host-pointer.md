---
'@weasel-js/labkit': patch
---

A `<CanvasStack>` or `<Stage>` under a scaled ancestor now reads the pointer in its own layout px: a tap reports the world point under the pointer, a wheel zoom holds that point still, the camera's `hostSize` is the layout size, and `worldToClient` places a context menu where the point is drawn.
