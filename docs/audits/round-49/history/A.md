# Audit round 49 — area `history` (blind reviewer)

## Suspending a journal with an active journal inside it leaves that inner journal writing while the history counts no journal open
- where: packages/history/src/journal.ts:207 (Journal.suspend)
- scenario: `outer = h.beginJournal(...)`; `child = outer.beginJournal(...)`; `outer.suspend()`. `suspend` never looks at `openChildren()`. Its `onClose` clears the root slot (`active = null`), but `child` stays active. After that, `h.undo()`/`h.goto()` pass `refuse()` and walk the root stack while the child's edits still sit over its top, and `h.beginJournal(...)` opens a second journal that writes to the adapter beside `child`. `child.commit()` also records into the suspended outer journal's entries through `_journalAccessInternal(inner).record`, so it gets around the "throws when the journal is not active" rule. What should happen: `suspend` throws while a journal inside it is active (as `commit` does), or suspends the children along with it. Either keeps "at most one journal writes to the adapter at a time" true.
- evidence: read (journal.ts:207-212 vs commit's check at 184; journalSlot.ts:23 onClose, :18 refuse)
- severity: medium

## The parent history's `apply` / `applyOps` / `recordEntry` run under an active journal, while `undo`/`redo`/`goto` refuse
- where: packages/history/src/history.ts:84-88,134 (createHistory apply/applyOps/recordEntry); recording.ts:51 (pushOrCoalesce)
- scenario: the adapter holds a list, and the ops push and pop. `j = h.beginJournal({label:'j'})`; `j.applyOps([push(1)])`; `h.applyOps([push(2)])`; `j.commit()`. The adapter is `[1, 2]`, but the stack is `[P(2), J(1)]`, with the journal's entry on top even though its ops ran first. `h.undo()` applies J's inverse (pop) and removes 2, not 1. The history and the document now disagree. The walk methods refuse for exactly this reason ("the journal's edits sit over this stack's top"). The push paths make no such check, so one question gets two answers. What should happen: pushes throw through `journals.refuse()` while a journal is active, as walks do.
- evidence: read (walk.ts:63 refuses; recording.ts push paths do not)
- severity: medium

## A `selection.set` that throws during undo/redo leaves the entry on a stack its ops have already left
- where: packages/history/src/walk.ts:40-57,66-80 (stepBack / stepForward / walkTo)
- scenario: the caller passes a `HistorySelection` whose `set` throws (for example, it validates ids against the scene). `h.undo()`: `stepBack` applies the inverses, then `selection.set(entry.selectionBefore)` throws before `undoStack.pop()`/`redoStack.push()` run. The entry stays on the undo stack with its inverses already applied. The next `undo()` inverts it a second time. walkTo's own comment promises "a throw leaves both stacks describing the state as it is". What should happen: move the entry once its ops have applied (or contain the selection write), so a throwing selection writer can't split the stacks from the state.
- evidence: read
- severity: medium

## A restored snapshot with an empty branch makes `branches()` and `switchBranch()` throw TypeError
- where: packages/history/src/snapshotShape.ts:39-44 (snapshotFault); forks.ts:18-20 (branchView), :115
- scenario: `h.restore({version:1, undoStack:[], redoStack:[], nextEntryId:1, droppedEntries:0, branches:[{at:0, entries:[]}]})` passes `snapshotFault`, since an empty list is a valid entry list. `rebuilt` stores `forks.set(0, [[]])`. `h.branches()` then reads `entries[0]!.id` on `undefined` and throws a TypeError, and `switchBranch(n)` throws the same way at `b[0]!.id`. That is the malformed-snapshot TypeError the shape check was added to replace (4fb24ca5d3). `snapshot()` never writes an empty branch, so what should happen: `snapshotFault` refuses one (or `rebuilt` drops it).
- evidence: read
- severity: low

## `createSwapOp`'s inverse has no `name`/`args`, so an observed undo reports applied ops that can't be identified or replayed
- where: packages/history/src/createSwapOp.ts:30 (createSwapOp invert)
- scenario: an `observe` listener forwards `step.entries[i].applied` (by `name`/`args`, which HistoryStep's doc says to read) to a peer or a log. For a swap-op entry, `undo` reports `applied` = `[ { label, apply, invert } ]`, with no `name` and no `args`. The listener can't tell what the undo did, although the forward op carries `{ before, after }`. What should happen: the inverse carries `name` and `args: { before: after, after: before }` (or a matching name), so the step's applied ops describe themselves as the forward op does.
- evidence: read (historyTypes.ts:63-74 says to read name/args off applied ops)
- severity: low

## A goto whose return walk also throws moves the stacks and bumps the version without telling `observe`
- where: packages/history/src/history.ts:112; walk.ts:88-100 (walkOrReturn)
- scenario: `h.goto(0)` from depth 3 throws at entry 1. The return walk then throws at entry 2, so the stacks stop at depth 2 with entry 3's inverses applied. `moved` is `() => clock.bump()` with no step, so `subscribe` fires and `observe` listeners get nothing, though the stacks and the document changed. `observe`'s contract is that only "a step that changed nothing reports nothing". A listener mirroring the document through `applied` falls out of sync. What should happen: bump with a `'goto'` step listing what was actually walked and applied, net.
- evidence: read
- severity: low

## `restore` keeps a future id from colliding with the restored entries but not with the restored floor or branch fork points
- where: packages/history/src/restore.ts:129-135 (rebuilt)
- scenario: a snapshot with `floor: 7`, `nextEntryId: 3`, and a branch `{at: 7, …}` passes `snapshotFault`. The bump loop only scans entry ids, so `nextEntryId` stays 3. After a few pushes a new entry gets id 7. `forkPoint()` at that entry then returns 7, and `branches()` lists the floor's futures as forking from it. `switchBranch` would put a future that starts from the floor state on top of entry 7's state. The comment promises that duplicate or out-of-range ids "should never produce a collision with future entries". What should happen: include `floor` and each branch's `at` in the bump.
- evidence: read
- severity: low

## `restore` accepts a snapshot of any `version`
- where: packages/history/src/snapshotShape.ts:31-36 (snapshotFault)
- scenario: a snapshot written by a later format, `version: 2` with entries whose meaning changed, passes the shape check and is rebuilt as version 1. `SerializedHistory.version` is typed `1`, and the scene's own snapshots refuse an unsupported version (unruled.md, round sixteen). What should happen: `snapshotFault` reports a `version` other than 1, so a strict restore throws `HistoryRestoreError` and a best-effort one reports `restored: false`.
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
