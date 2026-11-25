# Audit round 86 — history (blind reviewer)

## A failed undo or redo of a coalesced entry whose batches came in a different order leaves the state half-stepped
- where: packages/history/src/walk.ts:47 (aligned), :55-58 (stepBack), :65-68 (stepForward); unwound in packages/history/src/entryOps.ts:85 (applyAllOrNothing, `twins` branch)
- scenario: `canCoalesce` matches keys as a multiset precisely so a batch may re-emit its ops in any order (recording.ts:34-36). Push `[A1 (key a, x 0→1), B1 (key b, y 0→1)]`, then within the window `[B2 (y→2), A2 (x→2)]`: the entry holds `baseOps = [A1, B1]`, `forwardOps = [B2, A2]`, equal lengths, so `aligned()` is true and a failed step unwinds by position. Undo runs `inverses = [B1⁻¹, A1⁻¹]` with `twins = [A2, B2]`. Say `B1⁻¹` runs (y = 0) and `A1⁻¹` throws. The unwind applies `twins[0] = A2` (x = 2, which it already was), and y stays 0. The entry stays on the undo stack, but the document is at x = 2, y = 0: neither side of the entry. The unwind should have re-applied B2. Redo fails the same way: `B2` runs, `A2` throws, the unwind inverts `A1` instead of `B1`, and y stays at 2 with the entry still on the redo stack. A journal commit carrying a reordered coalesced inner entry inherits the same thing, because `appliedHalves` keeps the lengths equal. `aligned` only compares lengths. It should check that each position pairs ops with the same `coalesceKey`, or `coalesceEntry` should store the incoming batch in base order.
- evidence: read
- severity: medium

## A journal's commit notifies the parent's listeners while the journal still counts as active
- where: packages/history/src/journal.ts:254-258 (commit)
- scenario: `commit` calls the parent's `record`, whose `push` → `clock.bump` runs the parent's `observe` and `subscribe` listeners. Only after that does it set `state = 'closed'` and call `onClose`, which clears the slot's `active`. Inside those listeners, `history.activeJournal()` still returns the committing journal, and `history.apply`/`applyOps`/`undo` throw "A journal is already active". The emitter catches the throw and only logs it, so a listener that reacts to the new entry (a follow-up op, an undo-depth sync) is dropped silently. The close produces no parent notification afterwards, so a parent-subscribed view of `activeJournal()` keeps the stale answer. The journal should be closed, and the slot cleared, before the parent hears of the push.
- evidence: read
- severity: low

## `History.recordEntry` and `allForwardOps` docs say `Journal.commit` uses them, and it uses neither
- where: packages/history/src/historyTypes.ts:204-210 (recordEntry), :211-215 (allForwardOps)
- scenario: Per the docs, `recordEntry` is "Used by Journal.commit to flush a session's net forward ops", and `allForwardOps` is "useful for Journal.commit to flush to a parent". In the code, `commit` goes through the internal `_journalAccessInternal(...).appliedOps()` and `.record()` (journal.ts:254-255). It has to: it records both halves, and `recordEntry` throws while a journal is active (history.ts:154), which is exactly the case during a commit. A caller copying the documented route to flush a session (or a nested one) by hand gets a refusal while the journal is open. If they close it first, the coalesced entries are recorded from forward ops only, and undoing them goes to the wrong state.
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

<!-- done: 3 findings, files read: 18 -->
