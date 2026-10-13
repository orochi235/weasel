---
'@weasel-js/core': patch
'@weasel-js/history': patch
---

core: an undo entry now holds the scene's own ops whichever way the edit was made. `scene.applyBatch`, `scene.history.apply`, and a scene journal record the `kit:*` ops their ops caused, and beside them any op that wrote no scene state, such as a selection change. Undo and redo of such an entry restore what was written and no longer call the adapter the batch was applied with.

Breaking:

- `scene.carry` is removed. A pose an adapter writes beside the one it was asked for is an ordinary `scene.setPose`, and the entry holds it.
- `scene.applyBatch` inside `scene.batch` joins that batch's entry. It used to push an entry of its own ahead of the batch's.
- A journal opened on a history other than the scene's reverts in place. Its undo, redo, and cancel used to replay through the adapter and leave `setPose` and `update` entries on the scene's undo stack.
- `scene.serializeHistory()` returns a `SerializedSceneHistory`, which carries `form: 2`, and `scene.restoreHistory` drops a snapshot without it. A history persisted by an earlier version is not restored.

history: an `Op` may define `caused()`, which names the ops its entry records in its place once it has applied. An entry's `touchedIds` now also reads `args.nodes[].id`.
