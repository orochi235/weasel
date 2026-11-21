---
'@weasel-js/core': patch
---

A `useDragGesture`, `useDragRect`, or `useDragRadial` that unmounts mid-gesture cancels it, calling `onCancel` and `onGestureEnd(false)`.

<!-- entry: fix -->
