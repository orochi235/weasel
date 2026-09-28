---
"@weasel-js/routing": patch
"@weasel-js/modes": patch
---

The route-conflict check now compares actions gated by different `eligible` rules, where it used to assume they never hold together. Two such actions on one route conflict when some mode lets both rules hold and the rules don't exclude each other. The modes are the kit's `DEFAULT_MODES` unless `findScopedConflicts` / `reportRouteConflicts` is given a `modes` list. `ruleCanHoldIn(rule, mode)` answers the per-mode question, and `activeModeOf(definition)` in `@weasel-js/modes` builds the `ActiveMode` it reads — the same shape `getActiveModeFor` returns, which now uses it.
