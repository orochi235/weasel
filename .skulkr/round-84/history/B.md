# Audit round 84: history (blind reviewer)

## A branching history's kept branches grow without bound under `historyLimit`
- where: packages/history/src/forks.ts:79 (retireRedo), packages/history/src/forks.ts:64 (evictFloor)
- scenario: `createHistory(a, { branching: true, historyLimit: 50 })`. The user stands at depth 40, then repeats
  undo → edit → undo → edit. Each push keeps the retired redo future as one more branch under the same fork point,
  `forks.get(at).push(...)`. Branches are dropped only when their fork point falls off the floor (`evictFloor`), and
  `evictPast` counts only `undoStack.length`. The fork point never reaches the floor, so the branch list (and every op
  and node snapshot it holds) grows with each alternate edit while the undo stack stays under 50. `prune(t)` doesn't
  touch branch entries either. `historyLimit` is the only memory cap the options offer, and it does not bound a
  branching history.
- evidence: read
- severity: medium

## A strict restore into a history without `branching` throws over branches it was going to drop
- where: packages/history/src/restore.ts:126-133 (rebuilt), packages/history/src/history.ts:166-169 (restore)
- scenario: a snapshot saved by a branching history is restored into one made without `branching`, and one op in a
  kept branch has no rebuilder (for example a plugin that isn't loaded). `rebuilt` rebuilds every branch entry and
  counts its ops in `unresolved`. A strict restore then throws `HistoryRestoreError` for an op in a branch that
  `forks.replace` would have dropped (ruled 2026-11-24: drop with a warning). So the undo and redo stacks, which
  would all rebuild, are refused. A best-effort restore reports those ops as `unresolved`, though they were never
  restored. The fix is to skip branches when `branching` is off.
- evidence: read
- severity: medium

## `snapshotFault` throws a TypeError for a BigInt or circular `version`, so a best-effort restore also throws
- where: packages/history/src/snapshotShape.ts:35 (snapshotFault)
- scenario: a stored snapshot read from IndexedDB (a structured clone, which keeps BigInt values and cycles) has
  `version: 1n`, or an object holding a cycle. The template literal calls `JSON.stringify(snapshot.version)`, which
  throws `TypeError: Do not know how to serialize a BigInt` (or one for the cycle). `restore` then throws that raw
  TypeError. A strict restore should throw `HistoryRestoreError`, and a best-effort one should warn and return
  `restored: false`, since refusing a malformed snapshot is exactly the job of this guard.
- evidence: read
- severity: low

## A restored branch whose `at` names no entry is kept forever and can never be reached or evicted
- where: packages/history/src/snapshotShape.ts:40-49 (snapshotFault), packages/history/src/forks.ts:126-131 (replace)
- scenario: a branching history restores a snapshot whose `branches[i].at` names an id that is neither `floor` nor
  any entry (corrupted or hand-built storage). `snapshotFault` checks only that `at` is an integer.
  `forks.replace` stores the branch. `branches()` never lists it, because no fork point equals it. `evictFloor` and
  `evict` delete only keys that are the floor or an evicted entry's id, so it never goes either. Its entries stay in
  memory until `clear` or the next `restore`, and `nextEntryId` has been pushed past them. The shape check should
  refuse it, or `replace` should drop it.
- evidence: read
- severity: low

## The `onEvict` doc lists the wrong set of evictions
- where: packages/history/src/historyTypes.ts:244-251 (CreateHistoryOptions.onEvict)
- scenario: the doc says `onEvict` fires for "redo entries dropped by a branch edit … and undo entries evicted by
  `historyLimit`". With `branching: true`, a branch edit keeps the redo stack as a branch and fires nothing
  (`retireRedo`). The callback also fires for `prune`, for `dropRedo` on a history without branching, and for every
  branch entry evicted along with the floor (`evictFloor` → `evict`), and the doc names none of those. A caller
  reading it to release resources per evicted entry gets the wrong set of events.
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

<!-- done: 5 findings, files read: 17 -->
