---
'@weasel-js/geom': patch
---

`trackRun`'s `nearest` finds the nearest point on the run itself, as `trackSlice` does. A point past one end of a run over part of a shape snaps to that end.

<!-- entry: fix -->
