---
'@weasel-js/routing': minor
'@weasel-js/core': patch
---

A tool held on its key in a mode that leaves it out no longer takes over the options panel, the `[` and `]` size steps, or the tuning of the active tool's action: options follow the tool input routes to.

`tuneToolOptions` and `useToolOptionTunings` take that tool as a new optional last argument (`ToolsApi.routed`).

<!-- entry: fix api -->
