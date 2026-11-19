---
'@weasel-js/core': patch
---

`momentum` with `boundary: 'stop'` stops each flicked node at the edge it hits over every adapter, not only over a scene's

Over an adapter without `poseTarget`, a node of a flicked selection no longer slides along an edge until every node has reached one.

<!-- entry: fix -->
