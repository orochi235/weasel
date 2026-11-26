## Journal.cancel only rewinds downward, so it misses a suspended child whose enclosing journal undid below the child's edit depth, and cancel leaves residual state
- where: packages/history/src/journal.ts:262 (createJournalInternal → cancel), packages/history/src/history.ts:179 (JOURNAL_ACCESS.rewind)
- scenario: Journal J applies swap A (x 0→1). J opens child C, and C applies swap B (x 1→2). C suspends, which sets J.inner's slot `active` to null, so J's undo is allowed again. J.undo() then applies A⁻¹, so x=0 and J.inner's depth is 0, below the depth of 1 that `createChildren` recorded at C's last edit. J.cancel() calls `rewind(1)`, but `rewind` is `depth < undoStack.length && …`, and `1 < 0` is false, so it does nothing. Next, C is resumed and cancelled: `C.inner.goto(0)` applies B⁻¹ = emit(before=1), so x=1. Last, `inner.goto(0)` finds J's undo stack empty. Cancel ends with x=1, but J was opened at x=0. Cancel should return J to the state it opened from. It needs to walk J's inner to the recorded depth in both directions (redo up to `depth` while J's redo stack holds those entries) before cancelling the child. Today it only undoes.
- evidence: read
- severity: medium

## A restored snapshot with negative ids can make a later entry take id 0, the floor's id, so floor branches and that entry's branches merge into one
- where: packages/history/src/restore.ts:145 (rebuilt, `past`), packages/history/src/forks.ts:157 (reset), packages/history/src/snapshotShape.ts:6 (isId)
- scenario: `snapshotFault` accepts any id within ±2^52, negatives included. Restoring `{ version: 1, nextEntryId: -3, floor: -5, undoStack: [], redoStack: [], droppedEntries: 0 }` passes `past(-5)` and leaves `nextEntryId` at -3. Next, `clear()` resets `floorId` to 0 but leaves the id counter alone, so the following pushes take ids -3, -2, -1, 0. Entry 0 now shares its id with the floor. `forks` is keyed by id, so on a branching history `branches()` with entry 0 on top lists the floor's branches as its own, and `evictFloor`/`switchTo` treat the two as one fork point. `serialize()` then writes a snapshot that its own `restore` refuses ("names entry id 0, which is the floor it starts from"). Expected: entry ids never collide with a floor id the history can reach, for example by `clear` or `restore` lifting `nextEntryId` above 0, or by `isId` refusing ids below 0.
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
packages/history/src/textOf.ts
packages/history/src/versionClock.ts
packages/history/src/walk.ts

<!-- done: 2 findings, files read: 18 -->
