---
'@weasel-js/ui': patch
---

Unmounting a curve editor, or one of its layers, mid-drag cancels the drag: the layer's `onInput` gets the state the drag began from, then `onCancel` fires.

<!-- entry: fix -->
