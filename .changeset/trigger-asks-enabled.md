---
'@weasel-js/routing': patch
---

`ActionsRegistry.trigger` asks the action's `enabled` first, and returns `false` without running an action that refuses. It used to run a disabled action, so a caller that did not check `evaluateEnabled` itself fired one the same keystroke would not. This changes behavior: a `trigger` on a disabled action is now a no-op. `enabled` is called with the deps `run` gets and no point.
