## Journal.cancel never redoes what the enclosing journal undid after a suspended child's edit, so the child's edits are unwound against the wrong state
- where: packages/history/src/history.ts:178 (JOURNAL_ACCESS `rewind`), packages/history/src/journal.ts:245 (`cancel`)
- scenario: outer journal O applies e1, e2 (inner depth 2); O opens child C, C applies c1 (lastEdit depth recorded as 2); C suspends; O undoes e2 (allowed: a suspended child leaves O's inner slot `active` null), so O's inner depth is 1. `O.cancel()` calls `rewind(2)`, which only walks when `depth < undoStack.length` (2 < 1 is false), so nothing is redone; then `C.cancel()` inverts c1 in a state where e2 is already undone, then `inner.goto(0)` undoes e1. The true reverse order is redo e2, undo c1, undo e2, undo e1. With e2 = insert node N and c1 = an edit to N, c1's inverse runs against a deleted N (throws or writes a stale value). `rewind` should walk to `depth` in either direction while the redo stack still holds the entries (`depth !== undoStack.length`). This is O's own undo, not the sibling interleaving `docs/unruled.md` leaves open.
- evidence: read
- severity: medium
- fix: packages/history/src/history.ts
- size: line
- cause: rewind only lowers the depth
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
