# Audit round 88 — history (reviewer findings)

## restore splits an uncoalesced entry in two when its op args hold a Date, Map, Set or typed array
- where: packages/history/src/restore.ts:166 (sameSerialOps), used by serialToEntry at :189
- scenario: an entry nothing coalesced into (forwardOps === baseOps) whose op `args` hold a `Date` (or `Map`, `Set`,
  `Uint8Array`) is serialized and stored through IndexedDB / `postMessage` (a structured clone, which keeps those
  types and is the storage `SerializedHistory`'s doc names). `serialize()` writes the two halves as separate arrays,
  so on restore `sameSerialOps` falls to `deepEqual`, which answers false for any non-plain object that is not the
  same reference (`deepEqual.ts:28`). `sharedHalf` then stops its shared prefix at the first such op and rebuilds the
  rest of `baseOps` separately. The restored entry has `forwardOps !== baseOps`, so: `rebuildOp` runs twice for those
  ops; a best-effort restore lists each unrebuildable op twice in `report.unresolved` (its doc promises an op the two
  halves share once) and calls `onSkip` for both copies on every step; and undo/redo treat the entry as coalesced,
  unwinding a failed step through the `twins` path. Should: an entry whose serialized halves are value-equal restores
  as one array, whatever its args' types.
- evidence: read
- severity: low

## entry ids past Number.MAX_SAFE_INTEGER collide after a restore
- where: packages/history/src/restore.ts:155 (rebuilt, `past`), packages/history/src/recording.ts:90,105 (`nextEntryId++`)
- scenario: `snapshotFault` accepts any safe integer as an entry id, `floor` or `nextEntryId` (`isId` =
  `Number.isSafeInteger`). A snapshot naming id 2^53 − 1 (or `nextEntryId` 2^53 − 1) restores with `nextEntryId`
  2^53; the next push takes 2^53 and the one after computes 2^53 + 1, which rounds to 2^53, so two live entries share
  an id. `forks` is keyed by id, `switchBranch`/`branches()` and UI lists key on it, and a branch kept at one entry
  is then read as forking from the other. Should: refuse a snapshot whose ids leave no safe room to count on, or stop
  at the safe limit with an error.
- evidence: read
- severity: low

## a restored branching history over historyLimit keeps its branches over the cap until a push retires a redo stack
- where: packages/history/src/history.ts:166 (restore), packages/history/src/forks.ts:117 (retireRedo)
- scenario: `historyLimit` also caps the entries a branching history's kept branches hold together, but
  `evictBranchesPast` runs only from `retireRedo` (a push or `dropRedo` with a non-empty redo stack) and `switchTo`.
  Restore a snapshot whose branches hold more entries than `historyLimit` (saved under a larger limit, or by another
  build), then keep editing at the tip with nothing to redo: every push returns from `retireRedo` before the cap is
  checked, so the branches stay over the cap indefinitely, never reported through `onEvict`. The `onEvict` doc says
  a restored snapshot over the cap "re-applies (evicting via `onEvict`) on the next push", which holds for the undo
  stack (`evictPast` runs on every push) but not for the branches. Should: apply the branch cap on restore, or on
  every push.
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
