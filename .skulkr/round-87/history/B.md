## snapshotFault accepts branches unreachable from the snapshot's stacks, and an entry id that collides with the floor
- where: packages/history/src/snapshotShape.ts:56 (snapshotFault)
- scenario: a stored snapshot (storage corruption, or one hand-edited) with `branches: [{ at: 40, entries: [{ id: 50, … }] }, { at: 50, entries: [{ id: 40, … }] }]` passes: each `at` is an id the snapshot holds, but neither is reachable from `floor`, the undo stack or the redo stack. A branching `restore` puts both into `forks`. `branches()` never lists them and `switchBranch` cannot reach them, but `evictBranchesPast` counts their entries against `historyLimit` and evicts by lowest first id, so a reachable branch can be evicted in their place (or they are reported through `onEvict` long after the restore). The next `serialize` drops them and counts them in `droppedEntries`. Similarly, an undo entry whose `id` equals `floor` (or `0` with no floor) passes, since only entry ids are de-duplicated. `forkPoint()` then returns the same key for "standing on that entry" and "standing on the floor", so branches kept at the floor show up as forking from that entry. The check should reject a branch whose `at` is not reachable through the floor, the stacks or an accepted branch, and reject an entry id equal to the floor.
- evidence: read
- severity: low

## HistoryStep's `'coalesce'` doc says `ops` are what the push brought, but a folded `recordEntry` reports the whole entry
- where: packages/history/src/historyTypes.ts:60 (HistoryStep doc); packages/history/src/recording.ts:25 (coalesceStep)
- scenario: `recordEntry(a, 'x', { coalesceKey: 'k' })` and then `recordEntry(b, 'x', { coalesceKey: 'k' })` fold through `foldEntry`, which sets `top.forwardOps = [...a, ...b]`. `coalesceStep` reports `ops: top.forwardOps`, which is `[a, b]`, not `b`. The kind's doc line ("`ops` are the ones it brought") disagrees with that field's own doc ("the entry's forward ops") and with the code. An observer that follows the kind doc and replays or diffs `ops` as the delta applies `a` twice. For a `coalesceEntry` coalesce the two readings happen to agree, because the forward half is replaced. Only `applied` holds what was brought.
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
