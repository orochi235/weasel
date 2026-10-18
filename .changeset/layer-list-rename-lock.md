---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`LayerList` rows can be renamed and locked. `onRename` makes a one-line row's label editable: a double-click on it, or F2 on the focused row, opens a field that Enter or leaving commits and Escape drops. `onLockChange` adds a lock toggle beside the visibility checkbox. A locked row (`LayerListItem.locked`) can still be hidden and unlocked, but not dragged, renamed or removed; `renamable: false` opts one row out of renaming.

Breaking: what `LayerListItem.locked` used to mean, a row that cannot be dragged, hidden or removed and selects alone, is now `fixed`, so `locked` can name a layer's lock the way the scene does.

`useSceneLayerList` wires both to the scene: every row's checkbox and lock toggle hide and lock its node (`setHidden` / `setLocked` ops), an annotation layer's own row hides and locks the layer, and a `rename` argument, the data a new name writes, makes rows renamable.
