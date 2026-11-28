## A restored entry rebuilds the ops its two halves share in the middle as separate ops, so a failed undo of it replays a shared op twice
- where: packages/history/src/restore.ts:155 (sharedHalf)
- scenario: inside a journal, nudge node A twice (coalesces under key `a`, so its halves split), make a plain relative edit P to another node, then nudge A twice more (a second keyed run). Commit. The parent entry holds forward `[F1, P, F3]` and base `[B1, P, B3]`, with P one op shared by identity. Serialize and restore. `sharedHalf` shares only a common prefix and suffix, so the restored entry holds two distinct P ops. The keys repeat, so `aligned` is false and a failed undo takes `settleApart`. Say `inv(B1)` throws after `inv(B3)` and `inv(P)` ran. In memory, P counts as shared: only `inv(B3)` is reverted, and P is replayed once because it was reached, so P lands once. After the restore, both ran ops count as own: `inv(P)` is reverted (P applied), and then the whole forward half replays (P applied again), so P lands twice and the scene no longer matches the stack. It should land once, as it does before the restore.
- evidence: read
- severity: low
- fix: packages/history/src/restore.ts
- size: function
- cause: only the prefix and suffix are shared; a run in the middle is not
- confidence: likely

## A journal commit's entry takes `touchedIds` from its forward ops only; every other path takes them from both halves
- where: packages/history/src/recording.ts:97 (record)
- scenario: a coalesced entry (from `pushOrCoalesce`/`coalesceEntry`) merges the incoming ids into the ones it already has, so its `touchedIds` cover both halves, and `restore` (`serialToEntry`) derives them from base plus forward. A journal commit passes `appliedHalves`' split forward and base to `record`, which pushes `touchedIdsOf(forwardOps)` alone. When an inner coalesced entry's first batch touched an id that its latest batch does not (the keys matched as a multiset but the ids in the args differ), the committed entry's `touchedIds` leave that id out. Undo still writes to that node through the base half. The same entry also reports a different `touchedIds` after a serialize and restore round trip.
- evidence: read
- severity: low
- fix: packages/history/src/recording.ts
- size: line
- cause: touchedIds derived from one half when the halves differ
- confidence: likely

## Journal cancel can undo a nested journal's edits before an outer edit made after them, when the outer one undid and then edited again in between
- where: packages/history/src/journal.ts:170 (createChildren `touched` / depth), packages/history/src/journal.ts:253 (cancel)
- scenario: outer journal J holds entries E1..E3 (depth 3). Open child C, edit in it (depth 3 is noted), suspend C. In J, undo twice (depth 1), then apply E' (depth 2). Cancel J. `rewind(3)` does nothing because 3 ≥ 2, so `C.cancel()` undoes C's edit while E', which was applied after C, is still in force. Only then does `inner.goto(0)` undo E'. The docs promise that each child is cancelled "after undoing this journal's own edits made since", but E' was made after C and was not undone first. When E' and C's edit don't commute (relative edits to one node, text inserts), the adapter does not return to the state before J opened.
- evidence: read
- severity: low
- fix: packages/history/src/journal.ts
- size: design
- cause: an undo depth stands in for "edits since"
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

<!-- done: 3 findings, files read: 18 -->
