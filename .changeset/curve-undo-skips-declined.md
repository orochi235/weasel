---
'@weasel-js/ui': patch
---

Undo and redo in a curve editor pass over a step that would change nothing, such as one left by an edit its consumer declined, so each press undoes an edit that landed.

<!-- entry: fix -->
