---
'@weasel-js/ui': patch
---

`ResizeHandle` sends the size it commits on release through `onInput` first, so the pane always shows the size `onChange` persists.

<!-- entry: fix -->
