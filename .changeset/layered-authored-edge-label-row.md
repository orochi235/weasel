---
'@weasel-js/diagram': patch
---

`layered` keeps no label row for an edge whose route is authored. Such an edge between adjacent ranks still takes part in ordering when another edge's label row sits between them.

<!-- entry: fix -->
