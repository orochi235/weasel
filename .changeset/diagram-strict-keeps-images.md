---
'@weasel-js/diagram': patch
---

`DiagramView` and the effect editor no longer free the images and preview textures they still draw when React StrictMode remounts them.

<!-- entry: fix perf -->
