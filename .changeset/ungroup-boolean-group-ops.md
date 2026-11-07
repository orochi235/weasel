---
'@weasel-js/core': patch
---

Ungroup and Make Boolean Group build ops and commit through the `applyOps` dep, as Group does, instead of mutating the scene inside `scene.batch`. A consumer's own history used to miss them entirely, so a Cmd+G / Cmd+Shift+G pair split across two undo stacks. Each now lands as one entry that also restores the selection, and Offset Path's selection of its new paths joins its entry the same way. `booleanGroupOps(scene, ids, op)` returns the ops and the new group's id; `makeBooleanGroup` commits them straight to the scene, as before.
