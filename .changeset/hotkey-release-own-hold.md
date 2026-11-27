---
'@weasel-js/routing': patch
---

Releasing a tool held through `ToolsApi.engageHotkey`, or held on its key, removes that hold alone, so a later hold of the same tool keeps its place on top.

`ActiveToolContextValue.pushHotkey` now returns a function releasing the hold it made; an object implementing the interface by hand, such as a test double, returns one too.

<!-- entry: fix api -->
