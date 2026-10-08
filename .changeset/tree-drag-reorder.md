---
'@weasel-js/ui': patch
---

`Tree` reorders by drag and by Alt+arrow keys when given `onMove(ids, target)`, where `target` is `{ parentId, index }`. A drop into a dragged node or beneath it is always refused; `canDrop(ids, target)` refuses anything else the consumer forbids, such as leaving the parent. Without `onMove` the tree behaves as before. `useReorderDragList` now resolves its drop index through the same model; its behavior is unchanged.
