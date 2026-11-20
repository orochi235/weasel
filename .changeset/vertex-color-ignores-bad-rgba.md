---
'@weasel-js/editing': patch
---

`setVertexColor` ignores an `rgba` that is not four finite numbers, so the anchors after the one it names keep their colors.

<!-- entry: fix -->
