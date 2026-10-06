---
'@weasel-js/history': patch
---

`createHistory(adapter, { branching: true })` keeps the redo future when a push is made while there is one, instead of dropping it. Undo and redo still walk one line, the current branch; `branches()` lists the futures forking from the current entry, and `switchBranch(id)` makes one of them the redo future, keeping the one it replaces. An entry evicted by `historyLimit` or `prune` evicts the branches forking from it, each through `onEvict`, and `serialize()`/`restore()` carry them. Off by default, where nothing changes.
