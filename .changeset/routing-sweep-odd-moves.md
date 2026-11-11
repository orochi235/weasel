---
'@weasel-js/routing': patch
---

A sweep skips a move to a point that is not a finite number and hit-tests at most 4,096 points along one move. A
move to an infinite point hit-tested forever, a move to `NaN` stopped the sweep reaching anything after it, and a
jump of a trillion pixels hit-tested every 4 px of it. Each move now ends with a hit test at the point it went to.
