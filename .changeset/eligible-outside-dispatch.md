---
'@weasel-js/routing': minor
'@weasel-js/core': minor
'@weasel-js/ui': minor
---

A mode that bars an action bars its menu row, palette entry and bar button too, and `ActionsRegistry.trigger` refuses it.

A dispatcher given `getRuleCtx` publishes it as the new `ruleCtx` dep, and `eligibleNow(action, ruleCtx)` asks an action's `eligible` rule against it outside dispatch.

<!-- entry: fix api -->
