---
'@weasel-js/ui': patch
---

`ItemList` draws its own drop indicator: pass `dropIndex` (an insertion index, `0` above the first row, `rows.length` below the last — `useReorderDragList`'s `state.targetIndex` as-is) and the list marks the seam in the accent color. It is drawn from the row beside the seam, so it follows the rows' height at every density, needs no measuring, and adds no element to the list, so the drag hook needs no `rowSelector` to skip it. A row's new `dragging` flag dims it while it is being dragged.
