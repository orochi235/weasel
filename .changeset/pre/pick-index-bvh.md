---
"@weasel-js/geom": patch
"@weasel-js/core": patch
"@weasel-js/kernel3d": patch
---

Picks consult a BVH index kept beside the scene, so a marquee, a lasso or a click visits the nodes near the query instead of every node. `@weasel-js/geom` adds the tree. Three contracts tighten for the index to be sound. `NodeInk.outset` must not depend on the view scale: screen-space reach goes in `outsetPx`. In kernel3d, `world.bounds` must be a function of the node alone. Two picks change behavior: marquee and lasso now test a derived node at its derived path, and the point pick now tests a node carrying an override `path` against that path, which is what the renderer paints, instead of its pose box.
