---
"@weasel-js/ui": patch
---

A reorderable list, page strip, or token field shows no drop mark while releasing the drag would leave the dragged items where they are.

`useReorderDragList`'s `state.targetIndex` is `null` for such a gap, as it already was before a drag engages.

<!-- entry: fix visual -->
