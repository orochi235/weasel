---
'@weasel-js/labkit': patch
---

A canvas stack in a frame no longer counts CSS zoom on the frame twice: zoom already reaches the frame's device pixel ratio, so only a transform on the embedding page goes into its backing density. A zoomed frame's canvases were backed at twice the density they needed.
