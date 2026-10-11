---
'@weasel-js/history': patch
---

A branching history with a `historyLimit` (or after `prune`) offered branches from a state it could no longer return to: with the undo stack emptied down to the evicted entries, `branches()` listed futures that forked from the original start, and redoing one applied it on top of the evicted edits. The history now tracks the floor the evictions leave. An evicted entry takes along the branches that forked from the state before it and keeps the ones that fork from the state it leaves, which is the reverse of what eviction dropped before. `SerializedHistory` gains an optional `floor` so a restored history files those branches in the same place; a snapshot without it reads as before.
