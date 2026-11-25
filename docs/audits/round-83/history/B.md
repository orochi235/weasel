## A history's own `rebuildOp` returning `undefined` makes `restore` throw a TypeError; the per-restore hook's `undefined` is read as `null`
- where: packages/history/src/restore.ts:117 (rebuilt → op); packages/history/src/history.ts:150 (restore)
- scenario: `createHistory(a, { rebuildOp: (n) => n === 'x' ? op : undefined })` (a JS caller, or `map.get(name)?.(args)`), then `restore(snap)` with an unknown name → `'unresolved' in undefined` throws `TypeError: Cannot use 'in' operator`, not a `HistoryRestoreError`, and best-effort recovery cannot substitute a placeholder. The same hook passed as `restoreOptions.rebuildOp` works, because history.ts wraps it in `?? customRebuild?.(…) ?? null`. Two paths answer "what does a non-answer mean" differently; `rebuilt` should treat `got == null` as unknown.
- evidence: read
- severity: medium

## `recordEntry` stores the caller's ops array by reference, where `applyOps` copies it
- where: packages/history/src/history.ts:139 (recordEntry); packages/history/src/recording.ts:105 (record → push)
- scenario: a caller reusing one buffer: `buf.push(opA); h.recordEntry(buf, 'a'); buf.length = 0; buf.push(opB); …` → the entry's `forwardOps`/`baseOps` are the caller's live array, so undo of 'a' later inverts whatever the buffer holds then (or nothing). `applyOps` hands `owned = false` to `recordedOps`, which slices precisely because the caller's array is theirs to mutate (walk.ts's `readSelection` states the same rule). Same for `Journal.recordEntry`, which forwards to the inner history.
- evidence: read
- severity: medium

## `recordEntry` never reads an op's `caused()`, so an op whose effect is decided as it runs is re-decided on redo
- where: packages/history/src/recording.ts:94 (record)
- scenario: a caller applies an op that declares `caused()` itself and records it with `recordEntry([op], 'x')` → the entry holds `op`, not the ops it caused, so undo/redo re-run its decision against whatever the state is then. `pushOrCoalesce` replaces it through `recordedOps`; `Op.caused`'s contract ("what the entry records in this op's place once it has applied") does not say it only holds for `applyOps`. Journal commit is fine only because the inner push already substituted.
- evidence: read
- severity: low

## Op-key coalescing replaces the forward half while `recordEntry` key-folding concatenates — relative ops coalesce to the wrong state
- where: packages/history/src/entryOps.ts:116 (coalesceEntry) vs :87 (foldEntry)
- scenario: `coalesceWindowMs: 500`, three `applyOps([nudge(+1, key 'nudge')])` within the window (a delta op, the use the option's doc recommends: "nudge, per-keystroke text edits") → entry keeps base = first nudge, forward = third nudge. Undo inverts only the first → state is +2, not 0; redo then applies one +1. A `recordEntry` run under a `coalesceKey` appends every batch (`foldEntry`) and undoes exactly. Nothing in `Op.coalesceKey` or `CreateHistoryOptions.coalesceWindowMs` says a coalescing op must carry absolute before/after values; either the contract is stated or the two merges agree.
- evidence: read
- severity: medium

## Resuming a top-level journal through a different history leaves its own history unguarded
- where: packages/history/src/journalSlot.ts:28 (resume); packages/history/src/journal.ts:20 (_resumedByOwnerInternal)
- scenario: `j = A.beginJournal(…); j.suspend(); B.resumeJournal(j)` → `OWNER` is only set for nested journals, so B's slot resumes `j` and records it as B's active journal. `j` now writes to A's adapter while A's slot holds `null`, so `A.undo()` / `A.applyOps()` go through beneath the journal's edits — the very state `refuse()` exists to prevent; on commit the entry lands on A above edits made after it. Should throw (or route to the opening history) for a journal another history opened.
- evidence: read
- severity: low

## An enclosing journal's `cancel` unwinds a suspended child's edits before its own later edits
- where: packages/history/src/journal.ts:229 (cancel)
- scenario: outer journal opens child; child sets node x 0→a (swap op), suspends; outer sets x a→b. `outer.cancel()` → child's `goto(0)` sets x=0, then outer's `goto(0)` sets x=a. The document ends at a, not 0, where it was when the outer journal opened. Distinct from the sibling-interleave case `docs/unruled.md` leaves open: here only parent and one child interleave, and ordering by last edit across parent and children (child's `lastEdit` vs the outer's own) would undo it exactly.
- evidence: read
- severity: low

## A nested journal's `children` list and `lastEdit` map grow for the outer journal's life
- where: packages/history/src/journal.ts:133 (createChildren.adopt)
- scenario: a long-lived outer journal (a text-edit session) opening and committing a nested journal per sub-gesture → every closed child, its inner history and its entries stay reachable through `children` and `lastEdit` (and its `observe` subscription is never removed) until the outer closes. `openChildren` filters them out but never drops them; closed children should be removed on close.
- evidence: read
- severity: low

## `historyLimit: NaN` disables the cap instead of clamping
- where: packages/history/src/history.ts:57 (createHistory)
- scenario: `historyLimit: Number(setting)` with an empty/garbage setting → `Math.max(0, NaN)` is `NaN`, `undoStack.length > NaN` is always false in `evictPast`, so the stack grows unbounded. The doc promises negatives clamp to 0; a non-number slips past both clamp and cap.
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

<!-- done: 8 findings, files read: 17 -->
