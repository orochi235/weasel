---
'@weasel-js/diagram': patch
---

The add-lane click and the lane boundary drag write the scene they were built with. That is the scene their lane layer draws and their lock checks read, even where the canvas passes another.

<!-- entry: fix -->
