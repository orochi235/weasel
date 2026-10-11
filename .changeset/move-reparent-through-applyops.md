---
'@weasel-js/core': patch
---

A move with `reparentOnDrop` now commits as ops (`reparent`, `setLayer`, `transform`) like every
other move commit, so it reaches a consumer's `applyOps` hook and history. It used to write to the
scene directly and bypass both. A consumer with its own history that relied on reparent drops
landing in the scene's history will now receive them instead.
