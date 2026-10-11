---
'@weasel-js/core': patch
---

`momentum`: undoing a flick returned the node to the point of release, a position that was never a committed state, and nothing took it back to where the drag began. The recorded transform now starts at the drag's origin. Dragging a node again while it coasted left the first flick running, writing poses under the new drag and then moving the node to where the first flick came to rest; a new drag of a coasting node now stops the coast and records it where it stands.
