---
'@weasel-js/routing': patch
---

`ActionsRegistry.begin` no longer starts an action whose `eligible` rule or `enabled` refuses it. That reaches `useOngoingAction` too, and matches `trigger`.

<!-- entry: fix -->
