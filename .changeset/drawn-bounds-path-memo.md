---
'@weasel-js/core': patch
---

Path-posed and derived nodes keep their stroked drawn box between asks, so snapping no longer re-tessellates every such node's stroke on each pointer move.

<!-- entry: perf -->
