---
'@weasel-js/core': patch
---

A canvas whose scene a render worker paints draws its view exactly once a pan stops. It kept the last frame of the pan, drawn under a translation rounded to whole device pixels, until something else asked for a repaint.
