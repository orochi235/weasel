## A failed step on an entry whose two halves share uncoalesced ops replays those ops twice while unwinding
- where: packages/history/src/entryOps.ts:140 (appliedHalves), packages/history/src/entryOps.ts:97 (foldEntry), consumed at packages/history/src/entryOps.ts:83 (applyAllOrNothing settle) and packages/history/src/walk.ts (stepBack / stepForward)
- scenario: a journal holds entry 1 = [insert X] (never coalesced, so base === forward) and entry 2 = a coalesced nudge run (base [setPose p1], forward [setPose p3]). On commit, `appliedHalves` returns forward = [insert X, setPose p3] and base = [insert X, setPose p1], so the parent entry counts as "coalesced". Parent `undo()`: the inverses are [setPose→p0, delete X]. If `delete X` throws (done = 1), the unwind re-applies setPose p1, then `settle` applies the *whole* forward half: `insert X` runs a second time on a state that already holds X. A relative or non-idempotent op (an append, a counter, an insert into a list adapter) is duplicated, and an insert that refuses a duplicate throws, which is only logged. Redo fails the same way in reverse: after the unwind has already deleted X, settle inverts the whole base half and deletes it again. `foldEntry` on a top with split halves (a keyed journal commit that later folds a keyed `recordEntry`) appends the same relative ops to both halves, so the same thing happens. Settle should replay only the parts of the other half that differ, not the ops both halves share. As written, the step ends somewhere other than "where the call found it", which `op.ts`'s rollback contract and `History.goto`'s docs promise.
- evidence: read
- severity: medium

## A history without `branching` still rebuilds the branches it is about to drop, and a strict restore throws on them
- where: packages/history/src/restore.ts:125 (rebuilt), packages/history/src/restore.ts:131; packages/history/src/history.ts (restore → forks.replace)
- scenario: a history made without `branching` restores a snapshot whose `branches` hold an op the `rebuildOp` hook does not know. The round-83 ruling says that history drops the snapshot's branches with a warning and restores the rest. Instead, `rebuilt` rebuilds every branch entry first, records the unknown op in `unresolved`, and a strict restore throws `HistoryRestoreError` over an entry it would have thrown away, leaving the history unrestored. A best-effort restore succeeds, but its report lists unresolved ops in entries that are not in the history, and the rebuild hook runs for every dropped branch op. Branches should be skipped (or left out of `unresolved`) when the history does not branch.
- evidence: read
- severity: medium

## A malformed snapshot whose `version` is a BigInt throws a TypeError instead of being refused
- where: packages/history/src/snapshotShape.ts:33 (snapshotFault)
- scenario: a snapshot from structured-clone storage (IndexedDB, `postMessage`) carries `version: 1n`. `JSON.stringify(1n)` throws `TypeError: Do not know how to serialize a BigInt` while the fault message is being built. A best-effort `restore`, which should warn and return `{ restored: false }`, throws instead, and a strict one throws a TypeError rather than `HistoryRestoreError`. The value should be described with something that cannot throw (e.g. `typeof` or `String`).
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

<!-- done: 3 findings, files read: 17 -->
