---
'@weasel-js/guides': patch
---

`useGridCellHover` moves its cell when the view or the grid changes under a still pointer.

`getCell()` and each render read the cell again from where the pointer last was.

<!-- entry: fix visual -->
