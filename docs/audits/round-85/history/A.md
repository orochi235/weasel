## A listener that seals (or steps) the history in response to a push has its effect undone: `anchor()` runs after `bump()` notifies
- where: packages/history/src/recording.ts:84 (pushOrCoalesce, also :76 coalesce path and :103 record's fold/keyed push)
- scenario: a `subscribe` or `observe` listener calls `history.seal()` when it hears a push, so that the next edit starts a fresh entry. `push()` calls `clock.bump()`, which runs the listener synchronously, and `seal()` sets `anchorVersion = -1`. Control then returns to `pushOrCoalesce`, which calls `clock.anchor()` and sets `anchorVersion` back to the current version. The seal is lost, and the next keyed batch inside the window coalesces into the entry the listener sealed. Likewise, a listener that calls `undo()` bumps the version, and the later `anchor()` re-anchors at the post-undo version. The next keyed push then coalesces into the new top with no `retireRedo`, which breaks the "a live anchor implies an empty redo stack" invariant the coalesce path relies on (comment at :73), and the redo stack is left describing a future that no longer follows. The fix is to anchor before bumping, or to anchor only if the version is still the one the bump produced.
- evidence: read
- severity: medium

## A `recordEntry` / journal-commit push reports the entry's ops as `applied`, though that step applied nothing
- where: packages/history/src/recording.ts:51 (push, `stepOf('push', [entry], [entry.forwardOps])`, reached from `record`)
- scenario: `HistoryStep.applied` is documented as what the step applied, such that "applying them, in order, to a copy of the state the step started from makes the step's change", and as "empty for a step that moved the stacks without applying anything" (historyTypes.ts:75-79). `recordEntry` and `Journal.commit` push ops that already ran before the step, so the step itself applied nothing. They still report `applied = forwardOps`. An observer mirroring state by replaying `applied` onto its copy applies a journal's whole session a second time, after already having applied it from the journal's own steps or from the adapter.
- evidence: read
- severity: low

## A coalesce step's `ops` means two different things on the two coalesce paths
- where: packages/history/src/recording.ts:97 (record → foldEntry, then `coalesceStep(top, forwardOps)`)
- scenario: `HistoryStep.entries[].ops` is documented as "the entry's forward ops: what a redo of it would apply" (historyTypes.ts:74). On the op-key path (`coalesceEntry`), `top.forwardOps` becomes the incoming ops, so the step's `ops` match it. On the `recordEntry` key path (`foldEntry`), `top.forwardOps` becomes old + new, but the step reports only the new ops. An observer that takes `ops` as the entry's redo gets a truncated redo for every folded entry.
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
