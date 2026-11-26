# Audit round 89 — history (blind reviewer)

## Journal.cancel only rewinds the enclosing journal downward, so a child's edits are undone over a state the enclosing journal has since undone below, and the cancel does not return to where the journal opened
- where: packages/history/src/journal.ts:244 (createJournalInternal → cancel); packages/history/src/history.ts:178 (JOURNAL_ACCESS.rewind)
- scenario: Journal J (swap ops on property `p`) has entries E1 (sets `q`) and E2 (sets `p` 0→1), depth 2. J opens child C; C edits `p` 1→2 (C's `lastEdit.depth` = 2) and is suspended. J then undoes E2 (allowed: the child is suspended, so J's inner slot has no active journal), and E2's inverse writes `p = 0`. Now `J.cancel()`: `rewind(2)` does nothing, because it only walks when `depth < undoStack.length` (1 < 2 is false); C is resumed and cancelled, and its undo writes `p = 1` (its swap's `before`); then `inner.goto(0)` inverts E1, which touches only `q`. The cancel ends with `p = 1`, but the state J opened on had `p = 0`. Cancel should first walk J to the child's edit depth in either direction (redo back to 2, as `goto` would), then cancel the child. This is not the sibling-interleaving case ruled open in docs/unruled.md (round 49): there is a single child here, and the fault is that the walk only goes one way.
- evidence: read
- severity: medium

## A committed journal entry's `touchedIds` leave out ids that only its base half touches; the same entry after serialize/restore includes them
- where: packages/history/src/recording.ts:97 (record → `touchedIds: touchedIdsOf(forwardOps)`), vs packages/history/src/restore.ts:181 (serialToEntry) and packages/history/src/entryOps.ts:131 (coalesceEntry)
- scenario: a journal session coalesces two batches under one op `coalesceKey`, where the first batch's op args name node `a` and the later batch's name `b`. Its inner entry has `baseOps` touching `a` and `forwardOps` touching `b`. `appliedHalves` passes both halves to the parent's `record`, which derives `touchedIds` from `forwardOps` alone, giving `{b}`. Undoing that entry inverts `baseOps` and writes `a`. After `serialize` → `restore`, `serialToEntry` derives the set from both halves, giving `{a, b}`, and live coalescing (`coalesceEntry`) also keeps the base half's ids. So one question, which ids an entry touches, gets two answers, and `HistoryEntry.touchedIds` ("touched by any op in this entry") misses `a` on the live path. `record` should derive the set from both halves whenever `forwardOps !== baseOps`.
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
