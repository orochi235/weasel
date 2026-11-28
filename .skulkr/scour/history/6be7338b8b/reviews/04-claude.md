## Cancelling a resumed journal changes state beneath the parent's top entry without sealing the parent's coalescing run
- where: packages/history/src/journal.ts:262 (createJournalInternal → cancel)
- scenario: a journal J on history H applies X, then `suspend()` (which seals H). H then `applyOps([op keyed 'k'])` → entry A, with the coalesce window open. `resumeJournal(J)`, then `J.cancel()`: `inner.goto(0)` undoes X, which lies beneath A, and `close()` calls `onClose(false)`, which does not seal. H's anchor is still on A, so the next keyed `applyOps` inside the window coalesces into A. One undo then reverts across the cancel's change, which is the thing `suspend`'s seal exists to prevent ("a suspended journal's edits lie beneath its next push"). Should: a cancel that undoes edits made before a suspend seals the parent, as suspend does.
- evidence: read
- severity: low
- fix: packages/history/src/journal.ts, packages/history/src/journalSlot.ts
- size: line
- cause: cancel/commit close with `suspended=false`, so no seal, even after a suspend/resume cycle
- confidence: likely

## A restored snapshot's ids are allowed to run zero and below, so a later entry can take id 0, the id `clear()` gives the floor
- where: packages/history/src/snapshotShape.ts:8 (isId); packages/history/src/restore.ts:156 (rebuilt, nextEntryId)
- scenario: `restore({ version: 1, undoStack: [], redoStack: [], floor: -3, nextEntryId: -2, droppedEntries: 0 })` passes `snapshotFault`, since ids only need to lie within ±2^52, and `past(-3)` leaves `nextEntryId` at -2. Later pushes take ids -2, -1, 0, …. After a `clear()` (floorId back to 0) on a branching history, an entry with id 0 and the floor share key 0 in `forks`. Then `forkPoint()` answers 0 for both "at the floor" and "at entry 0", and `branches()`/`switchBranch` list one's futures as the other's, while `evictFloor` strands the wrong branches. Should: reject an id ≤ 0 in a snapshot (live ids start at 1, and 0 means the floor), or clamp `nextEntryId` to at least 1.
- evidence: read
- severity: low
- fix: packages/history/src/snapshotShape.ts, packages/history/src/restore.ts
- size: line
- cause: id validation allows non-positive ids, which collide with floor sentinel 0
- confidence: likely

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
