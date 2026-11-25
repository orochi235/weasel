---
'@weasel-js/routing': patch
---

`ToolsApi.disengageHotkey()` releases only holds its own `engageHotkey` made, so a tool held on its key stays held.

<!-- entry: fix -->
