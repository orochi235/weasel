---
'@weasel-js/svg': patch
---

`svgNodesFromKit` warns when it leaves out a path's per-anchor `vertexColors`. It reports through `onWarn` for a fill's or a stroke's, rather than dropping them silently.

<!-- entry: fix -->
