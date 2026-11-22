---
'@weasel-js/core': patch
---

Undo and redo skip a move or add an untracked edit made illegal, instead of losing the subtree from the document. That is a move under the node's own descendant, or under a parent now on a higher layer.

<!-- entry: fix -->
