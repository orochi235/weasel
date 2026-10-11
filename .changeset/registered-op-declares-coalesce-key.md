---
'@weasel-js/core': patch
---

A custom op kind registered with `scene.registerOp` no longer coalesces just because its payload carries an `id` or `layer`: with `coalesceWindowMs` set, a relative op such as a nudge by `dx` merged into one entry and undo reverted only the first step. `RegisteredOp` gains an optional `coalesceKey(payload)`, new engine surface for any op kind whose `revert` restores an absolute state; a kind that does not declare it is always its own undo entry, so a consumer kind that relied on merging now has to declare one.
