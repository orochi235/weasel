---
'@weasel-js/core': patch
---

During an undo, redo, or history step, a scene's overrides listeners hear of a change after its own subscribers, as they do for any other edit.

<!-- entry: fix -->
