---
'@weasel-js/routing': patch
---

A sweep skips a move to a point that is not a finite number, and hit-tests at most 4,096 points along any one move. Each move ends with a hit test at the point it went to.

<!-- entry: fix -->
