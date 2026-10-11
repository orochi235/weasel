---
'@weasel-js/core': patch
---

Successive `applyBatch` edits that re-arrange the same children of a layout container now coalesce into one undo entry inside `coalesceWindowMs`, as edits that arrange nothing already did. The arrange op's coalesce key was read before the op had applied, when it has none.
