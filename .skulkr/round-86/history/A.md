# Audit round 86 — history (reviewer findings)

## A failed undo/redo of a coalesced entry unwinds with the wrong partner ops when the coalesced batches listed their keyed ops in different orders
- where: packages/history/src/walk.ts:46 (aligned), :52-55 (stepBack), :62-65 (stepForward); packages/history/src/entryOps.ts:84 (applyAllOrNothing, twins branch)
- scenario: `aligned` treats equal-length halves as pairing op for op, and the twins unwind undoes the step's `i`th op with `twins[i]` by position. But `canCoalesce` (recording.ts:35-39, `sameCoalesceKeys`) deliberately matches keys as a multiset "so a multi-id selection can re-emit ops in any order between batches". Push `[moveA(k:a), moveB(k:b)]`, then coalesce `[moveB'(k:b), moveA'(k:a)]` inside the window: baseOps `[moveA, moveB]`, forwardOps `[moveB', moveA']`. On undo, inverses are `[inv(moveB), inv(moveA)]` and twins are `[moveA', moveB']`. If `inv(moveB)` applies and `inv(moveA)` throws, the unwind applies `twins[0] = moveA'` — rewriting A (never touched) and leaving B at its pre-edit value, while the entry stays on the undo stack claiming B is at its latest value. Redo is symmetric: forward `[moveB', moveA']`, twins `invert(baseOps)` → `moveB'` ran, `moveA'` throws, unwind applies `invert(moveA)`, moving A back to its base state and leaving B forward. Should either align by key (pair each op with its same-key partner) or fall to the `ownOps` path when positions do not match keys.
- evidence: read
- severity: medium

## A suspended journal's own coalesce window survives the parent's edits made while it was suspended
- where: packages/history/src/journalSlot.ts:27-30 (begin's onClose) and :34-39 (resume); packages/history/src/journal.ts:270-274 (RESUMERS)
- scenario: the slot seals the *parent* on suspend because "a suspended journal's edits lie beneath its next push", but nothing seals the journal's inner history on suspend or resume, and the journal's state changes bump only the journal's own counter, not the inner clock, so the inner anchor stays valid. Journal J (window 500 ms) applies keyed `set x=1` (x was 0), suspends; the parent applies `set x=5`; J resumes within the window and applies keyed `set x=2`. It coalesces into J's top entry (base `x 0→1`), so `J.undo()` writes x=0, silently discarding the parent's x=5, where an unmerged entry would have undone to 5. Should seal the inner history on suspend (or resume), mirroring the parent-side seal.
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
