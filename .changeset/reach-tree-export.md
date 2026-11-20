---
'@weasel-js/core': minor
---

`createReachTree` exports the index a culled scene walk and the pick index run on, in any dimension, for a host's own index.

It keeps each node's own box and the reach of its subtree, from a `ReachSource` that boxes a node and reads `scene.changesSince`, and answers which children, or which nodes, meet a box, a set of half-spaces or a ray. Boxes are `[min…, max…]` in the source's dimension.

<!-- entry: api -->
