---
'@weasel-js/core': patch
---

Alt-dragging a group inserted an empty container and copied none of its children, and with a group and one of its children both selected the child was copied a second time beside the original. `cloneAction` now copies each selected node with its whole subtree, the way `duplicateAction` does, keeps a copied node's `dependsOn` and derive functions, and previews the children it will copy.
