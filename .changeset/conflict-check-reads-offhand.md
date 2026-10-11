---
'@weasel-js/routing': patch
---

The route-conflict check (`findScopedConflicts`, `reportRouteConflicts`) compared hotkey-held tools only when the trigger was written as `ToolDef.hotkey`. Two entries declaring `eligibility: { offhand }` directly can be held together and tie on a binding just the same, and are now reported.
