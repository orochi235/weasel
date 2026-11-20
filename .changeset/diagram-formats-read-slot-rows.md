---
'@weasel-js/diagram-formats': patch
---

`documentFromScene` reads a shape's image and framed slots back as `slot` rows, so a saved diagram redraws them.

Each keeps its place, height, width, id and image. A slot with neither an image nor an id draws nothing the scene keeps, so it is still not read back.

<!-- entry: fix data -->
