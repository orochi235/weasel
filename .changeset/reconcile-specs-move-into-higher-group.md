---
"@weasel-js/core": patch
---

`reconcileSpecs` brings a node into a group on a higher layer when the same specs raise the node to that layer. It moved the node before raising it, so the scene refused the move, a child below its parent's layer, and the render worker's copy of the scene threw on that sync.
