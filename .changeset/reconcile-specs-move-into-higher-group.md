---
"@weasel-js/core": patch
---

`reconcileSpecs` can move a node into a group on a higher layer in the same specs that raise the node to that layer.

The render worker's copy of a scene follows such a change instead of throwing on that sync.

<!-- entry: fix -->
