---
'@weasel-js/ui': minor
---

`Tree` takes `onRowKeyDown`, called with a key on a row before the tree's own keys, and `onRowContextMenu` for a right-click on one.

`preventDefault()` in `onRowKeyDown` keeps the tree out of that key, which is how `LayerList` opens a rename on F2.

<!-- entry: api -->
