# Audit round 51 — labkit.state (blind reviewer)

Tree read: 674caba3dd (the brief's d6aa8f2 is not in this clone; `packages/labkit/src/state` has no local changes).

## A remote snapshot record this tab cannot load keeps the stale snapshot and also lists it unreadable
- where: packages/labkit/src/state/labRecordReads.ts:55 (remoteSnapshot)
- scenario: another tab rewrites snapshot `s1` with a config this tab's migration throws on. `hydrateSnapshots` reports `s1` to `failed`, so `unreadable` gains `{kind:'snapshot', id:'s1'}`, but `if (!snapshot) return saves` keeps the old `s1` in `savedSnapshots`. The same id is now both loadable (old content, offered in Load) and listed in the unreadable strip. Pressing Discard deletes `save:s1` through `deleteDiscarded` while the stale copy stays in the store, so it loads in this session and vanishes on reload. `remoteTrial` answers the same case the other way (drops the stale trial, line 39) — one decision, two answers. Should drop the stale snapshot as the trial path does.
- evidence: read
- severity: medium

## A fold whose write-back fails seeds `meta` into the cache, so the session never writes `meta` and the next open re-folds the old document over its edits
- where: packages/labkit/src/state/openLabStore.ts:235 (foldOldStorage), with packages/labkit/src/state/labRecordWrites.ts:161 (writeStoreChanges)
- scenario: a lab stored as a version-3 document (or the four legacy keys) opens; `writeConfirmed` throws partway (e.g. a quota error on one trial's `storage.set`), so `meta`, written last, never lands and the old keys are kept. But `records.seed(entries)` already put every entry, `meta` included, in the cache. The session's edits then write `trial:<id>` records, and `writeStoreChanges` writes `meta` only when the mode changes or `!records.has(META_RECORD)` — which is false, because of the seed. Storage ends the session holding the new trial records and no `meta`. The next open finds no `meta` (`documentOfRecords` → null), folds the old document again and `writeConfirmed` writes its trials over the newer `trial:` records: every edit of the previous session to those trials is lost, trials deleted in it come back, and trials added in it are left as records outside the store until some later open joins them back in. Should seed only once the write-back is confirmed, or leave `meta` out of the seed so the first write re-sends it.
- evidence: read (seed is "hold without writing", packages/storage/src/records.ts:207)
- severity: medium

## `openLabStore` leaves its record cache open when building the store throws
- where: packages/labkit/src/state/openLabStore.ts:70 (openLabStore), and :73 / :79 in the late path
- scenario: `openLabStore({ instruments: [a, b] })` where `a.name === b.name`. `openRecords` has already subscribed to storage and registered its page-leave flush; `createLabStore` → `initialHooks` → `assertUniqueNames` throws, the promise rejects, and nothing calls `records.close()`. The cache keeps listening to the storage's change feed and the leave handler for the page's lifetime, and every remount retry (an error boundary resetting `<Lab>` or `SingletonExperimentProvider`) opens another. Should close `records` on a throw.
- evidence: read
- severity: low

## Own-undo data parked for a trial is never dropped when the trial closes
- where: packages/labkit/src/state/ownUndo.ts:63 (holdOwnUndo's release)
- scenario: a trial's instrument unmounts while the trial stays in the store (any view that unmounts a trial's content without closing it), so the release parks `source.serialize()` — a whole serialized history — under the trial's id, along with an `onTrialRestart` listener. The trial is then closed. Only a remount (`unpark` in `holdOwnUndo`) or a Reset/Load (the restart listener) ever deletes a parked entry, and neither happens for a closed trial, so the entry and the listener stay in the store's `Held` until the store itself is collected. One leaked history per trial closed this way, unbounded over a long session. Should unpark when the trial leaves `trials`.
- evidence: read (no other reader or writer of `parked` in packages/labkit/src)
- severity: low

## `newId`'s fallback ids collide across tabs, though they name records every tab shares
- where: packages/labkit/src/state/helpers.ts:28 (newId)
- scenario: a lab opened over a LAN address (not a secure context, so no `crypto.randomUUID`) in two tabs that start together, as a browser's session restore does. Each tab's counter starts at 0, so two trials (or snapshots) made in the same millisecond both get `lk-<ms>-0`. They are stored as the same `trial:<id>` / `save:<id>` record under one prefix, so each tab's write replaces the other's and both tabs end up holding one trial's record under two different instruments. The comment's premise, that these ids "name records inside one session's store", is wrong: they are persisted record names read by every tab and every later load. Should add randomness (e.g. `Math.random`) to the fallback.
- evidence: read
- severity: low

## Files read
packages/labkit/src/state/Persistence.tsx
packages/labkit/src/state/SingletonExperiment.tsx
packages/labkit/src/state/bindLabStore.ts
packages/labkit/src/state/context.tsx
packages/labkit/src/state/document.ts
packages/labkit/src/state/helpers.ts
packages/labkit/src/state/hydrate.ts
packages/labkit/src/state/index.ts
packages/labkit/src/state/instrumentHooks.ts
packages/labkit/src/state/labRecordReads.ts
packages/labkit/src/state/labRecordWrites.ts
packages/labkit/src/state/labRecords.ts
packages/labkit/src/state/labStorage.ts
packages/labkit/src/state/openLabStore.ts
packages/labkit/src/state/ownUndo.ts
packages/labkit/src/state/savedUndo.ts
packages/labkit/src/state/snapshotActions.ts
packages/labkit/src/state/snapshots.ts
packages/labkit/src/state/store.ts
packages/labkit/src/state/trialFields.ts
packages/labkit/src/state/trialRecordActions.ts
packages/labkit/src/state/trialRestarts.ts
packages/labkit/src/state/types.ts
packages/labkit/src/state/undock.ts
packages/labkit/src/state/useOpenOnce.ts
packages/labkit/src/state/usePersistedState.ts
packages/labkit/src/state/useTrialState.ts
packages/labkit/src/state/view.ts
packages/labkit/src/state/watchTrialHistories.ts

<!-- done: 5 findings, files read: 29 -->
