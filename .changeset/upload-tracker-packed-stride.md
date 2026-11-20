---
'@weasel-js/renderer': patch
---

`createUploadTracker` reads a tightly packed vertex buffer at its attribute's size, so a color buffer is four floats per vertex.

<!-- entry: fix -->
