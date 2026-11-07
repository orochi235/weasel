---
'@weasel-js/geom': patch
---

`pathFromD` writes the moveto SVG implies when a drawing command follows `Z` (`M0 0 h10 v10 z l5 5`), so the subpath after it opens with an `M` at the closed one's start. Left implicit, the path's anchors were numbered differently by the walkers that count the start and those that do not, and its corner shapes were never drawn.
