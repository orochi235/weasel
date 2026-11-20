---
'@weasel-js/d3': patch
---

A node interrupted by another transition is no longer removed by a later `.remove()`, nor restarted by a transition chained afterwards.

<!-- entry: fix -->
