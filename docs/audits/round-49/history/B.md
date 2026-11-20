# Audit round 49 — area `history` (blind reviewer)

## Suspending a journal leaves a journal opened inside it active, so the history accepts undo and a second journal while that child still writes
- where: packages/history/src/journal.ts:207 (Journal.suspend)
- scenario: `const j = h.beginJournal({label:'a'}); const c = j.beginJournal({label:'b'}); j.suspend();`. `suspend` only checks its own state and calls `onClose`, which nulls the root slot's `active`. `c` stays active: `c.applyOps(...)` still writes the adapter, while `h.activeJournal()` answers `null`, `h.undo()` no longer refuses and walks entries beneath both journals' live edits, and `h.beginJournal(...)` opens a second journal. That breaks "at most one journal writes to the adapter at a time". `suspend` should refuse while a child is active (as `commit` refuses with open children), or suspend the child along with it.
- evidence: read
- severity: medium

## A raw history's apply, applyOps, recordEntry, clear, restore, prune, dropRedo and switchBranch do not refuse while a journal is active, so an entry can land beneath a journal's later commit
- where: packages/history/src/history.ts:84-157 (createHistory: apply/applyOps/clear/restore/prune/dropRedo/switchBranch, recordEntry)
- scenario: journal `j` active, `j.applyOps([setX(1)])`, then `h.applyOps([setX(2)])`. The second pushes straight onto the parent stack, since only `walkTo` calls `journals.refuse()`. `j.commit()` then records the journal's entry on top: the stack reads [setX(2), j] while the edits ran j then setX(2). `h.undo()` inverts j first and restores x to its pre-journal value, while the stack still claims setX(2) is applied. `restore` and `clear` the same way swap the stack out from under an open journal's applied edits. core's `scene.loadState` already refuses this (unruled.md, round 41), but the engine does not. `undo`/`redo`/`goto`/`beginJournal` refuse; the other mutators should too, or the decision should be the same in both places.
- evidence: read
- severity: medium

## Canceling a journal unwinds its children in the order they were created, not the order their edits ran
- where: packages/history/src/journal.ts:197 (Journal.cancel)
- scenario: inside `j`: `c1 = j.beginJournal()`, `c1.applyOps(A)`, `c1.suspend()`, `c2 = j.beginJournal()`, `c2.applyOps(B)`, `c2.suspend()`, `h.resumeJournal(c1)`, `c1.applyOps(C)`. `j.cancel()` walks `openChildren().reverse()` = [c2, c1] and so inverts B before C, although C ran after B. When C and B touch the same state, the result is not the pre-journal state. Resuming c2 through `RESUMERS` also bypasses the inner slot, and c2's `onClose` then nulls the slot's `active` while c1 is still active.
- evidence: read
- severity: low

## `History.undo`/`redo` skip the journal refusal when their stack is empty
- where: packages/history/src/history.ts:90-99 (undo, redo)
- scenario: with a journal active and an empty undo stack, `h.undo()` returns silently. With a non-empty stack it throws ("A journal is already active"). The doc ("Throws while a journal is active") and unruled.md round 16 say it throws. A caller that relies on the throw to route to the journal does nothing on a fresh history. The early `return` sits ahead of `walkTo`'s `refuse()`.
- evidence: read
- severity: low

## `restore` bumps `nextEntryId` past every restored entry id but not past `floor` or a branch's `at`, so a new entry can take the floor's id
- where: packages/history/src/restore.ts:132-135 (rebuilt)
- scenario: the snapshot passes `snapshotFault`: `{ nextEntryId: 1, floor: 5, undoStack: [], redoStack: [], branches: [{ at: 5, entries: [...] }] }`. Entries then get ids 1, 2, …, 5. Once entry 5 is on top, `forkPoint()` answers 5 and `branches()` lists the floor's kept futures as forking from the new entry, so `switchBranch` puts them on the redo stack from the wrong state. The comment says a malformed snapshot "should never produce a collision with future entries". `floor` and every `at` need the same bump.
- evidence: read
- severity: low

## `History.restore` never checks the snapshot's `version`
- where: packages/history/src/snapshotShape.ts:31 (snapshotFault)
- scenario: `SerializedHistory.version` is the literal `1`, but `snapshotFault` never reads it. A snapshot from a later format (`version: 2`) whose entries still have the v1 field names is restored as v1 rather than refused. The scene snapshot refuses an unsupported version with `SnapshotShapeError` (unruled.md, round 16), so the two snapshots answer the same question differently.
- evidence: read
- severity: low

## `createSwapOp`'s inverse has no `name` or `args`, so an observed undo of a swap reports an anonymous op
- where: packages/history/src/createSwapOp.ts:30 (createSwapOp)
- scenario: `HistoryStep.entries[].applied` reports an undo's inverses (commit c6f965b5e8), and observers read `name`/`args` from them. The inverse returned by `invert()` carries only `label`, `apply` and `invert`, so an observer relaying steps (to storage or a remote) cannot tell what an undo of a theme-editor swap applied. The forward op names itself and carries `{ before, after }`. The inverse could carry the same name with the args swapped.
- evidence: read
- severity: low

## Files read
packages/history/src/createSwapOp.ts
packages/history/src/entryOps.ts
packages/history/src/forks.ts
packages/history/src/history.ts
packages/history/src/historyTypes.ts
packages/history/src/index.ts
packages/history/src/journal.ts
packages/history/src/journalSlot.ts
packages/history/src/op.ts
packages/history/src/recording.ts
packages/history/src/restore.ts
packages/history/src/serialized.ts
packages/history/src/snapshotShape.ts
packages/history/src/stackTime.ts
packages/history/src/stackView.ts
packages/history/src/versionClock.ts
packages/history/src/walk.ts

<!-- done: 7 findings, files read: 17 -->
