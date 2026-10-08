---
'@weasel-js/ui': patch
---

`Tree` reorders by drag and by Alt+arrow keys when given `onMove(ids, target)`, where `target` is `{ parentId, index }`. A drop into a dragged node or beneath it is always refused; `canDrop(ids, target)` refuses anything else the consumer forbids, such as leaving the parent. Without `onMove` there is no drag. `useReorderDragList` now resolves its drop index through the same model; its behavior is unchanged.

Every `Tree` is also less deeply indented: a branch's fold mark now hangs in a gutter left of its label instead of sitting in a column that leaves reserved too, so labels at one depth line up and each level steps in by one mark's width. `--wzl-tree-indent` still overrides the step.
