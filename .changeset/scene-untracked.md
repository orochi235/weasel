---
'@weasel-js/core': patch
'@weasel-js/history': patch
---

Add `scene.untracked(fn)`, which applies scene mutations without recording them, for writes that are not edits, such as a simulation stepping poses each frame. It notifies once, reverts on throw, and refuses `applyBatch` and `history.apply` / `applyOps`. Undo never restores an untracked write; undoing the next recorded change lands on the pose the untracked writes left.

Add `History.seal()`, which ends the current coalescing run so the next entry is pushed fresh. This adds a member to the `History` interface, so a hand-written implementation of it must add `seal`.
