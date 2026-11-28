## A goto that throws and walks all the way back rewrites entries' selections with no version bump or step
- where: packages/history/src/walk.ts:118 (walkOrReturn), packages/history/src/walk.ts:126 (reported)
- scenario: a history with `selection`, depth 3; `goto(1)` undoes entry 3 (`stepBack` sets `e3.selectionAfter` to the live selection), then entry 2's inverse throws. `walkOrReturn` redoes entry 3 (`stepForward` overwrites `e3.selectionBefore` with the live selection) and rethrows. The stacks end at the depth they started from, so `reported` skips its report and `getVersion` does not move. But `entries()` now returns different `selectionBefore`/`selectionAfter` for entry 3 than it did before the call, and the next undo/redo restores the selection the failed walk wrote rather than the recorded one. A `useSyncExternalStore` reader keyed on `getVersion` keeps showing the old views. The fix is either to bump when any entry's selection fields changed, or to keep the selection writes from a walk that was rolled back.
- evidence: read
- severity: low
- fix: packages/history/src/walk.ts
- size: function
- cause: the selection is written on the way past even by a walk that gets rolled back
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

<!-- done: 1 findings, files read: 18 -->
