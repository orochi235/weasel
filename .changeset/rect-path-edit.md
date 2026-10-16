---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

A rectangle stored as a rect `data.path` can be edited in path edit: it shows its four corners as anchors, and the first edit stores it as the equivalent polygon, in the same undo step as that edit. Entering and leaving path edit without editing leaves it a rect. The path commands that act on the selected paths, such as offset, now take a rectangle too. Additive: `asPolygonPath` (geom, re-exported by core) returns any `Path` as a command stream, a rect as its corners clockwise from its origin, the order `countPathAnchors` numbers them in, so per-anchor colors keep their corners; core's `hasEditablePath(node)` says whether path edit can show anchors for a node.
