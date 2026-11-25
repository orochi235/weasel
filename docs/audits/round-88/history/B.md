# Audit round 88 — area `history` — blind reviewer findings

## A coalesced entry whose ops repeat a coalesceKey is unwound against the wrong twins when a step throws
- where: packages/history/src/walk.ts:43 (aligned), used by stepBack/stepForward at walk.ts:51-68; unwinding at packages/history/src/entryOps.ts:97 (applyAllOrNothing, `twins` branch)
- scenario: `sameCoalesceKeys` (entryOps.ts:10) explicitly matches keys as a multiset, counting duplicates, so a batch where two ops share one key can coalesce, e.g. user ops or `kit:` ops keyed by a shared `layer` token (opTable.ts:72-79 keys `kit:` ops on `p.layer` when there is no `id`), or any consumer ops keyed `'restyle:1'`-style. Take base `[opA1 (key k, node A), opB1 (key k, node B)]`, then a coalesced batch that re-emits them in the other order: forward `[opB2 (k), opA2 (k)]`. `aligned()` compares only `coalesceKey` per position, sees `k`/`k` at both positions and returns true, so the step pairs ops by position. On undo the inverses run as `[opB1⁻, opA1⁻]` with twins `[opA2, opB2]`; if `opA1⁻` throws after `opB1⁻` ran (done = 1), the unwind applies twins[0] = `opA2` (node A, already at its forward value) instead of `opB2`. Node B is left at its pre-edit value while the entry stays on the undo stack claiming the forward state. Should: pair only when each position holds the same op target (or fall to the `from`/`other` settle whenever a key repeats), as the multiset match already allows reordering.
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

<!-- done: 1 findings, files read: 18 -->
