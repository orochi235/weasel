# Audit round 51 — labkit.state findings

## A fold whose records could not be confirmed keeps writing records without `meta`, so the next open re-folds the old storage over this session's edits
- where: packages/labkit/src/state/openLabStore.ts:234-248 (foldOldStorage), with packages/labkit/src/state/labRecordWrites.ts:161 (writeStoreChanges)
- scenario: a version-3 document (or the four legacy keys) is folded; `records.seed(entries)` puts every record, `meta` included, into the cache (seed only fills `values`, packages/storage/src/records.ts:207). `writeConfirmed` then fails part-way — e.g. `storage.set` of `meta`, written last, throws on quota — and the code only warns "keeping the old storage", leaving `records` writable. The user edits trials; `writeStoreChanges` writes their `trial:*` records but never `meta`, because `records.has(META_RECORD)` is already true from the seed (only a mode change writes it). On the next open `documentOfRecords` finds no `meta`, returns null, and `foldOldStorage` folds the old document again and `writeConfirmed` writes its stale trial records over the ones edited last session. Every edit made in the session after the failed fold is silently lost. Expected: either stop writing when the fold cannot be confirmed, or not seed `meta` (so the first write puts it down).
- evidence: read
- severity: medium

## `setInstruments` rewrites a stale snapshot over another tab's newer record it could not read
- where: packages/labkit/src/state/labRecordReads.ts:55 (remoteSnapshot), packages/labkit/src/state/store.ts:94-96 (setInstruments), packages/labkit/src/state/hydrate.ts:127 (rehydrated)
- scenario: another tab rewrites snapshot `s1` with a config this tab's `migrateConfig` throws on. `remoteSnapshot` keeps this tab's old `s1` in `savedSnapshots` (and lists `s1` as unreadable too). Later the lab calls `setInstruments` with a new object for that instrument; `rehydrated` always returns a new object (`{ ...held, config }`), so `writeSnapshotChanges` sees a changed identity and `records.set(saveRecord('s1'), stale)` overwrites the other tab's record with the old one. `remoteTrial` drops the stale trial for exactly this reason (its comment at line 38), so the two record kinds answer the same question two ways. Expected: drop the stale snapshot as a stale trial is dropped.
- evidence: read
- severity: medium

## An unreadable remote snapshot is listed twice: still in `savedSnapshots` and in `unreadable`, and discarding the unreadable entry deletes the record of a snapshot still shown
- where: packages/labkit/src/state/labRecordReads.ts:55 (remoteSnapshot), packages/labkit/src/state/labRecordWrites.ts:67-78 (deleteDiscarded)
- scenario: as above, a remote write of `s1` fails to hydrate while `s1` is held locally. The store now holds `s1` in `savedSnapshots` and an `UnreadableRecord { kind: 'snapshot', id: 's1' }`. The user discards the unreadable entry → `deleteDiscarded` deletes `save:s1`, yet `s1` stays in the snapshot list, loadable, with no record behind it until reload makes it vanish. Expected: one state per id.
- evidence: read
- severity: low

## `setInstruments` with any changed instrument object rewrites every trial record of that instrument even when nothing changed
- where: packages/labkit/src/state/hydrate.ts:118-128 (rehydrated), packages/labkit/src/state/labRecordWrites.ts:46-53 (persistedFieldsDiffer)
- scenario: `changedInstruments` keys on object identity, so a lab passing a freshly built instrument list (same names, new objects) calls `rehydrated` on every trial; it re-runs `migrateConfig` on an already-migrated config and always returns `{ ...held, config: filledConfig(...) }`, a new config object. `persistedFieldsDiffer` compares `config` by `Object.is`, so every trial of the instrument is serialized and written (each one also re-serializing its undo history). A non-idempotent `migrateConfig` is additionally run twice on the live config. Expected: keep `held` when the re-hydrated config is equal.
- evidence: read
- severity: low

## A parked instrument undo outlives its trial's removal
- where: packages/labkit/src/state/ownUndo.ts:59-66 (holdOwnUndo release)
- scenario: an instrument's `useTrialHistory` source is released while its trial is still in the store (instrument swapped, or the component holding the history unmounts) → its data is parked with an `onTrialRestart` listener. The trial is then removed with `removeTrial`; nothing announces a restart or watches removal, so the `parked` entry (the full serialized history) and its keyed-emitter listener stay for the store's lifetime, one per such trial. Expected: drop parked data when the trial leaves `trials`.
- evidence: read
- severity: low

## `as3DView` checks `depth` only when it rebuilds the camera; a whole-lens view passes any `depth` through
- where: packages/labkit/src/state/view.ts:59-71 (as3DView)
- scenario: a stored view `{ target, yaw, pitch, distance, fov, near, far, depth: 'bogus' }` (or a `depth` left by a future version) has a whole lens, so `view as Camera3d` is returned with `depth: 'bogus'` to `clampCamera`; the same view missing `fov` would have had `depth` dropped to the default. One input field, validated on one path only.
- evidence: read
- severity: low

## `SingletonExperimentProvider` throws when `id` changes after mount, without the read-once warning its sibling props get
- where: packages/labkit/src/state/SingletonExperiment.tsx:42-60
- scenario: `id` is read once inside `useOpenOnce` to add the synthetic trial, but `TrialIdProvider` takes the current `id` each render. A parent that changes `id` (e.g. derived from a route) makes `useTrialState` throw `No trial found with id "…"`; `useWarnIgnoredChange` covers only `storageKey` and `storage`, and `initialConfig`/`initialState` are equally read once. Expected: warn (or keep the mount-time id).
- evidence: read
- severity: low

## `newId`'s fallback ids are persisted and shared across tabs, though the comment says they only need to survive one page load
- where: packages/labkit/src/state/helpers.ts:15-29 (newId)
- scenario: outside a secure context (lab opened by LAN IP) ids are `lk-<ms>-<counter>`, counter starting at 0 in every tab. Trial and snapshot ids are record names in storage shared by every tab (`trial:<id>`, `save:<id>`) and survive reloads. Two tabs adding a trial in the same millisecond both mint `lk-<ms>-0` and write the same record, each overwriting the other's trial. Unlikely, but the stated justification is false.
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

<!-- done: 8 findings, files read: 29 -->
