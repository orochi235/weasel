---
'@weasel-js/routing': patch
---

`ActionsRegistry.trigger` returns `false` for an action it cannot run: one with an ongoing invoker, or none. It used to return `true` after doing nothing.
