# Audit round 87, area `history`

## A failed undo of an entry whose halves share ops replays the coalesced forward ops after the shared ones, leaving the state other than where the undo found it
- where: packages/history/src/walk.ts:62 (stepBack), with packages/history/src/entryOps.ts:84 (applyAllOrNothing, the `ops` settle)
- scenario: a journal session holds entry 1, a coalesced keyed batch whose second batch listed its keys in another order (`forwardOps [Ky:y, Kx:x=5]`, `baseOps [Kx:x=3, Ky:y]`, so `aligned` is false), then entry 2, a plain op `P` setting x=9. Commit records `forwardOps [Ky, Kx5, P]`, `baseOps [Kx3, Ky, P]`; `P` is the same object in both halves. The same shape comes from `foldEntry` onto a split top. Undo runs `[P⁻¹, Ky⁻¹, Kx3⁻¹]`; when `Ky⁻¹` throws (done = 1), the unwind reapplies `P` (x=9) and then `ownOps(forwardOps, baseOps)` = `[Ky, Kx5]`, which sets x=5. The entry stays on the undo stack claiming the state after `P` (x=9), but the document holds x=5. The settle should replay the forward half in its own order (the own ops before the shared ops that follow them), not the own ops after every shared op. The redo path lands correctly because the base inverses come last there.
- evidence: read (traced by hand; not run)
- severity: low

## A listener that hears a nested journal's commit cannot commit or cancel the enclosing journal: the closed child is still in the enclosing journal's open-children list
- where: packages/history/src/journal.ts:232 (commit), packages/history/src/journal.ts:140 (createChildren.adopt)
- scenario: journal E holds child C. `C.commit()` calls `close()` and then `record` into E's inner history, which tells E's `observe`/`subscribe` listeners about the push. The comment at line 230 says those listeners may edit the parent in turn. But C leaves E's `children` only when C's own `bump()` runs afterward. So a listener calling `E.commit()` throws "A journal inside this one is still active or suspended", and a listener calling `E.cancel()` reaches `latestFirst()` with C still listed, sees `!C.isActive()`, and calls `RESUMERS.get(C)!()` on an entry `close()` already deleted: TypeError. The emitter catches and logs either throw, so E stays open. Expected: C stops being an open child as soon as it closes.
- evidence: read
- severity: low

## `restore` and `switchBranch` spread whole stacks into call arguments, which throws on a large history and can leave the two stacks out of step
- where: packages/history/src/history.ts:166 (restore), packages/history/src/forks.ts:137 (switchTo)
- scenario: the default `historyLimit` is unbounded. Restoring a snapshot with a stack over the engine's argument limit (around 10⁵ entries in V8) throws a `RangeError` from `undoStack.splice(0, n, ...next.undoStack)`. If the undo splice succeeds and the redo one throws, the undo stack is already replaced while the redo stack and forks still hold the old history, and nothing reports it. `switchTo` has the same issue with `redoStack.push(...[...chosen].reverse())`, and there the branch has already been spliced out of `forks`. Expected: replace the contents without spreading (assign `length` and copy in a loop), or do every step that can throw before mutating anything.
- evidence: read (the argument limit is engine behavior, not measured here)
- severity: low

## `Journal.commit` documents one entry under the commit's label, but a keyed session folds into the parent's top entry and drops the label
- where: packages/history/src/journal.ts:113 (Journal.commit doc) against packages/history/src/recording.ts:93 (record)
- scenario: the parent's top entry was recorded by `recordEntry(..., { coalesceKey: 'K' })`. A journal opens with no stack move in between (beginJournal does not bump the parent clock, so the anchor holds), records only `K`-keyed entries, and commits with `label: 'Edit text'`. `appliedHalves` carries `K`, and `record` takes the `foldEntry` path: no new entry, no `'Edit text'` label, and the observed step is `'coalesce'`, not the `'push'` that `HistoryStep`'s doc lists for a journal's commit. The doc says "Flushes the journal to its parent as one entry labelled `label`".
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

<!-- done: 4 findings, files read: 18 -->
