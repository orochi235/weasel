---
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

The drags `@weasel-js/ui` starts through `startThresholdDrag` — reordering a list, dragging a `Tree` row, and picking up a node from the schema editor's palette or its live preview — engage at the `gestures.dragPx` kit setting, as the canvas's own drags already did, instead of always at `DRAG_THRESHOLD_PX`. `useReorderDragList`'s own `threshold` option still wins.
