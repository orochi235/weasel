---
'@weasel-js/diagram': patch
---

`buildGraph` leaves out an edge from a container or pool to something it holds, as `diagramScene` does, rather than handing layout a loop on the region.

<!-- entry: fix -->
