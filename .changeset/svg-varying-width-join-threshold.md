---
'@weasel-js/svg': patch
---

A variable-width stroke keeps its `varyingWidthJoinThreshold` through SVG export and import. Its outline in the SVG is drawn with it, so its joins match the canvas.

<!-- entry: fix data visual -->
