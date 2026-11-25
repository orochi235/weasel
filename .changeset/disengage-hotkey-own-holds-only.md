---
'@weasel-js/routing': patch
---

`ToolsApi.disengageHotkey()` releases only a hold its own `engageHotkey` made, and does nothing when there is none, so a tool held on its key (Space for the hand) stays held.

<!-- entry: fix -->
