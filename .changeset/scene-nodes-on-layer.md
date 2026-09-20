---
'@weasel-js/core': patch
'@weasel-js/d3': patch
---

`Scene.nodesOnLayer(layer)` returns one layer's nodes in render order, cached
beside `renderOrderNodes()` until the next structural edit — so a pose tween,
which fires per frame, does not throw the walk away.

`d3Bind(...).join()` uses it. The diff used to scan every node in the scene on
every call to find the leaves on its own layer; it now classifies enter and
update with `scene.get` and scans only the target layer for exits. The
semantics are unchanged: a leaf on the target layer whose key is absent from
the data still exits, and nodes on other layers and containers are still left
alone.
