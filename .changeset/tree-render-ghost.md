---
'@weasel-js/ui': patch
---

`Tree` takes `renderGhost`: a stand-in to draw beside the pointer in place of the dragged rows, asked on every move with the dragged ids, the drag's effect, and whether the pointer has left the tree. `PrefSchemaEditor` uses it, so a drag begun in the structure tree shows the node as the form draws it once it leaves the tree, as a palette drag and a preview drag already did, with a count when it carries several.
