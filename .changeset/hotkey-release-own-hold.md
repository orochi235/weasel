---
'@weasel-js/routing': minor
---

Releasing a tool held through `ToolsApi.engageHotkey` or on its key removes that hold alone, not a later hold of the same tool.

`ActiveToolContextValue.pushHotkey` now returns a function releasing the hold it made; an object implementing the interface by hand, such as a test double, returns one too.

<!-- entry: fix api -->
