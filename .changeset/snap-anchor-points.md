---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

A node can now declare points of its own that a move snaps, through `<SceneCanvas snap={{ anchors }}>`
or `createSnapSession2d({ anchors })`: a function from a node id to points in that node's box frame,
such as a cabinet's hanger holes. Each becomes a probe of the new role `'anchor'`, offered only to a
source whose `roles` list it, so a grid can land the holes on a pegboard's while alignment and spacing
keep measuring the box.
