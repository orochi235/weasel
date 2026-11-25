# Audit round 83 — history (blind reviewer)

## Opening or suspending a journal leaves the parent's coalesce window open, so a parent edit coalesces across the journal's applied edits
- where: packages/history/src/journalSlot.ts:22 (begin), packages/history/src/journal.ts:226 (suspend); packages/history/src/recording.ts:37 (canCoalesce)
- scenario: `parent.applyOps([moveN1], 'Move')` with keyed ops and a 500 ms window (anchor set). Within the window, `beginJournal`, journal moves n1 again, `suspend()`; then `parent.applyOps([moveN1'], 'Move')`. Nothing bumped the parent's clock or sealed it, so `clock.anchored()` is still true and the new batch coalesces into the pre-journal entry. Undoing that entry inverts its base ops and puts n1 back where it was before the first move, wiping the suspended journal's edit underneath it (the journal still thinks it is applied; resuming and cancelling then inverts against the wrong state). Should behave as `seal` documents: a change the stack does not know about ends the run — opening (or suspending) a journal should seal the parent.
- evidence: read
- severity: medium

## An enclosing journal keeps every closed nested journal (and its whole inner history) alive
- where: packages/history/src/journal.ts:117 (createChildren.adopt)
- scenario: a long-lived journal (e.g. a text-edit session) opens a nested journal per sub-edit; each is pushed onto `children`, gets a `lastEdit` entry and an `observe` subscription, and none is ever removed when it commits or cancels — `openChildren` only filters on `RESUMERS`. Memory grows with every nested journal (each retaining its inner history's ops) for the life of the enclosing journal, and `openChildren`/`latestFirst` scan the whole list on every commit/suspend/cancel.
- evidence: read
- severity: low

## `resumeJournal` on a history the journal was not opened on resumes it into that history's slot
- where: packages/history/src/journalSlot.ts:27 (resume), packages/history/src/journal.ts:20 (_resumedByOwnerInternal)
- scenario: top-level journal `j` opened on history A, suspended; `B.resumeJournal(j)`. `OWNER` has no entry for a top-level journal, so B's slot takes `active = j` and `j` becomes active. A's slot still holds `null` (suspend cleared it), so `A.applyOps`/`A.undo` are not refused while `j` writes to A's adapter and will commit into A — the one-active-journal guarantee is broken. Should throw unless `j` belongs to this history.
- evidence: read
- severity: low

## A throwing `invert()` during rollback replaces the original error and skips the rest of the unwind
- where: packages/history/src/entryOps.ts:79 (applyAllOrNothing)
- scenario: batch [a, b]; `b.apply` throws E1; `ops.slice(0, done).reverse().map((op) => op.invert())` runs outside `applyUnwinding`'s try, so if `a.invert()` throws E2, E2 propagates instead of E1, `a` is never undone and `settle` never runs — the state is left half-applied, contrary to the comment that the unwound throw is the one the caller sees and a second one is only logged.
- evidence: read
- severity: low

## `historyLimit: NaN` silently disables the cap
- where: packages/history/src/history.ts:60 (createHistory)
- scenario: `historyLimit` from an unparsed setting (`Number('')`→0 is fine, `Number('abc')`→NaN): `Math.max(0, NaN)` is NaN, `undoStack.length > NaN` is always false in `evictPast`, so the stack grows unbounded with no warning, where a negative value is clamped to 0.
- evidence: read
- severity: low

## Restoring a snapshot with branches into a non-branching history gives it branches it never evicts
- where: packages/history/src/history.ts:158 (restore → forks.replace), packages/history/src/forks.ts:82 (retireRedo)
- scenario: history created with `branching: false`; restore a snapshot from a branching one. `forks.replace` installs the branches; `branches()` lists them and `switchBranch` uses them, though the history was configured not to keep futures. They are also never reported via `onEvict` when a push retires the redo stack (that path only evicts the redo future), so they linger until floor eviction.
- evidence: read
- severity: low

## `snapshotFault` accepts duplicate entry ids
- where: packages/history/src/snapshotShape.ts:31 (snapshotFault)
- scenario: a corrupted snapshot holding the same `id` in two entries (or a branch whose first entry shares an id with the next redo) passes the shape check. Forks are keyed by id, so branches attach to the wrong entry, `switchTo` treats a branch as "already current" when its id equals the redo top, and `evict` deletes the shared key's forks for both. The check exists to refuse snapshots storage corrupted; duplicate ids are such a corruption.
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

<!-- done: 7 findings, files read: 17 -->
