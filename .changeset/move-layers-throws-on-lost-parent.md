---
'@weasel-js/ui': patch
---

`moveLayers` throws when a move's `parentId` names no layer in the tree, or a moved one, rather than losing the moved layers.

<!-- entry: fix behavior -->
