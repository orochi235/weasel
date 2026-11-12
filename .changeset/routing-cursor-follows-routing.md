---
"@weasel-js/routing": minor
"@weasel-js/core": patch
---

A canvas shows the cursor of the tool its input goes to, so a tool the active mode bars no longer shows its cursor.

`ToolsApi.routed` and `ContributionsApi.routed` name that tool: the newest held tool the mode allows, else the active tool if the mode allows it, else `null`.

<!-- entry: fix api -->
