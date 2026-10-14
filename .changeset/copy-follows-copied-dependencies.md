---
'@weasel-js/core': patch
---

Duplicate and Alt-drag clone point a copied node's `dependsOn` list at the copy of each dependency that was copied with it, and at the original of each that was not. A copy used to follow the copies only when every dependency was copied, so duplicating an edge with one of its endpoints left the new edge on both original endpoints, drawn over the first. A copy none of whose dependencies were copied still follows the originals.

Changes behavior: a copied derived node with some of its dependencies in the copy now derives from a mix of copies and originals.
