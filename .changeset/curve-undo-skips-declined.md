---
'@weasel-js/ui': patch
---

Undo and redo in a curve editor pass over a step that would change nothing, such as a declined edit's.

Each press undoes an edit that landed.

<!-- entry: fix -->
