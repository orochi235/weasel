---
'@weasel-js/core': patch
---

Fixes: `scene.loadState` kept a selected node the loaded snapshot puts on a locked layer, so `getSelection()` answered with a node `isLocked` called locked. It drops such ids now, as every other selection write does.
