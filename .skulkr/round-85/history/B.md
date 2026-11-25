# Audit round 85 — area `history` (blind reviewer)

## A failed undo of a journal-committed entry re-applies the coalesced halves after the shared ops that originally ran after them, leaving stale values
- where: packages/history/src/walk.ts:51 (stepBack), with packages/history/src/entryOps.ts:89 (applyAllOrNothing settle) and packages/history/src/entryOps.ts:136 (appliedHalves)
- scenario: a journal holds entry 1, coalesced from two batches of a keyed `setPose(n, …)` (base B1 writes x=5, forward F1 writes x=10), then entry 2, a non-keyed op X that also writes n's x (x=15). Commit records forwardOps `[F1, X]` and baseOps `[B1, X]`, with X shared by identity. Undo of that parent entry applies `[inv X, inv B1]`. If `inv B1` throws having changed nothing, the unwind re-applies X (x=15, which is correct: the state is back where the undo started), and then `settle` applies `ownOps(forward, base)` = `[F1]`, so x=10. The entry stays on the undo stack claiming the state is x=15. Settle applies own ops after every unwound shared op regardless of their original order, and even when the throwing inverse was one of theirs and changed nothing. The same applies to a restored entry whose halves share a suffix (`sharedHalf` in restore.ts).
- evidence: read (inferred from the code path, not run)
- severity: low

## A grandchild journal's edits don't count as its parent journal's latest edit, so an enclosing cancel unwinds in the wrong order
- where: packages/history/src/journal.ts:132 (createChildren.adopt / touched), used by packages/history/src/journal.ts:232 (cancel)
- scenario: journal E opens child C, and C opens grandchild G. G edits, G suspends, C suspends, E edits node n (depth goes up), then C and G are resumed and G edits n again. E's `lastEdit` for C still holds the time and depth of C's open or C's own last step, because `touched` hears only C's inner `observe`, and G's edits reach C's inner history only when G commits (resuming C bumps `subscribe`, not `observe`). `E.cancel()` then rewinds E to that older depth first, undoing E's late edit while G's later edit is still applied on top, and only after that cancels C and G. G's inverse then writes back the value E had set. Result: E's edit survives the cancel, though cancel should leave the adapter as it was when E opened.
- evidence: read (inferred)
- severity: low

## `activeJournal()` answers the outer journal while a nested one is active, and that journal refuses every apply/undo
- where: packages/history/src/journalSlot.ts:33 (active), docs at packages/history/src/historyTypes.ts:212
- scenario: `h.beginJournal(a)` returns J, then `J.beginJournal(b)` returns K. `h.activeJournal()` returns J, documented as "the journal open on this history now, which applies and undoes in its place". `J.applyOps`, `J.undo` and `J.redo` all throw "A journal is already active", because J's inner slot holds K. A caller routing edits through `activeJournal()` gets a throw rather than the journal that actually takes edits (K).
- evidence: read (inferred; did not trace core's use)
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

<!-- done: 3 findings, files read: 18 -->
