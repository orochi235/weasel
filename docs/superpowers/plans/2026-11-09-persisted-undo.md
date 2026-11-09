# Undo history that survives a reload — plan

**Unbuilt (2026-11-09).** Scaffolding for one branch; delete when it merges.

For whoever builds it: labkit labs and the theme editor lose their undo stacks on reload. Draw
and chart already keep theirs (`@weasel-js/editor`'s `useSessionPersistence`). This plan makes
labkit trials and the theme editor do the same, on the history engine's own `serialize`/`restore`.

## Rules every step keeps

- History is saved **in the same write as the state it undoes**, so the two cannot drift. Labkit
  writes one record per trial (`bindLabStore.ts` `writeTrial`), so a trial's undo goes in that
  record. The theme editor writes its state under one key per surface, so its undo goes beside it.
- Redo is saved too.
- Disk stays bounded by the limits the stacks already have: a trial's `maxDepth` (default 50), and
  each scene's own history limit.
- An entry whose op can't be serialized drops that entry **and every older one**, never just that
  entry, so Undo can't silently skip a step. Check how `History.serialize` reports
  `droppedEntries` today. If it leaves placeholders mid-stack, truncate in the labkit wrapper.
- Reset and snapshot load clear the saved history, as they clear the live one now
  (`state/trialRestarts.ts`).
- Saved `editStamp`s come back as they were, and `editStamp` is seeded past the largest one restored
  (a new `seedEditStamp(max)` in `undo/editStamp.ts`), so the three stacks still interleave by time.

## Step 1 — the trial's own stack (labkit)

- Replace `stateOp` (`undo/stateOp.ts`) with a registered op, named `labkit:trialEdit`. Its args are
  plain data: `{ fields: 'settings' | 'edit', before, after? }`. Its `apply` writes through the
  history's adapter, `{ store, trialId }`, which `useTrialSnapshot` passes to `createHistory`. That
  replaces today's `null`. `after` is filled into the args when the entry is undone, the way
  `createMoveToIndexOp` fills `prevPositions`, so a redo entry saves it.
  - `useTrialWrites.ts:101` builds the same op with `fields: 'settings'`.
  - `useTrialSnapshot.ts` `ownEntry` builds it with `fields` set by `settingsOnly`.
- Restore through `createHistory`'s `rebuildOp` option. It rebuilds `labkit:trialEdit` with the
  trial's adapter, and re-applies the `fenced` and `undone` wrappers that `useTrialSnapshot.snapshot`
  adds today. Move those two wrappers into one function that both paths call.
- Persist: `SerializedTrial` (`state/types.ts`) gains `undo?: { trial?: SerializedHistory }`.
  - `serializeTrials` (`state/helpers.ts`) writes `history.serialize()` into it.
  - `hydrateTrials` restores it into a fresh `createHistory`.
  - Bump `CURRENT_DOCUMENT_VERSION` (`state/document.ts`) to 5. Migration 4→5 is the identity: a
    record with no `undo` loads with an empty stack.
- Saving on change: `bindLabStore`'s store subscription ignores the `history` key (line 36), and a
  history step doesn't change the trial record. So subscribe to each trial's
  `history.subscribe`/`getVersion` and call `writeTrial` on a step, on the same debounce the record
  cache already applies.
- Another tab's write (`bindLabStore.ts` ~179): it hydrates today with an empty undo stack. Now the
  incoming record carries that tab's history, so restore it. The comment there goes.
- `stateOp`'s doc line "Never serialized: trial undo is session-only", and `SerializedTrial`'s
  "everything but the undo history, which is session-only", are rewritten or deleted with the code.
- Tests, in the `labkit` project:
  - Round trip: edit, edit, undo, then serialize and rebuild the store. Undo and redo then step the
    same values.
  - Reset clears the saved stack.
  - A version-4 record loads with an empty stack.
  - Two tabs: a record written in one restores the other tab's stack.
  - A stack with an unserializable entry truncates from that entry back.

## Step 2 — marks and the instrument's own history

- `TrialHistorySource` (`trial/trialHistory.ts`) gains optional `serialize(): unknown` and
  `restore(data: unknown): void`. These are public: say so in the changeset.
- `sceneTrialHistory` (`scene/sceneTrialHistory.ts`) implements them with
  `scene.history.serialize()`/`restore()`, plus its `editStampsOf(scene)` map keyed by entry id.
  Check that the ids survive `restore`; if not, save the stamps by stack position. The settings
  entries the trial records onto the scene are `labkit:trialEdit`, so they serialize once Step 1
  lands. `TrialSceneCanvas`'s scene state is already saved in the trial record, so its history goes
  in the same write as `undo.own`.
- A source mounted after hydration gets the restore when it mounts. `useMountedHistory`'s `mount`
  hands it the saved `undo.own`, once per trial load.
- Marks: `annotations/store.ts` owns a `MarkHistory` over one scene per target.
  - Save each target scene's history, plus `MarkHistory`'s `undoable`/`redoable` steps
    (target and stamp), as `undo.marks`.
  - `MarkHistory` gains `toJSON()`/`fromJSON()`.
  - Marks that declare their own `storage` (`state/types.ts:55`) save their history in that storage,
    beside the marks.
- Tests:
  - A `TrialSceneCanvas` trial edits the scene, changes a setting, and adds a mark. After a reload,
    Undo takes back mark, then setting, then scene edit, in that order.
  - An instrument history without `serialize` starts empty and still works.

## Step 3 — theme editor

- `useLabHistory` (`apps/theme-editor/src/useLabHistory.ts`): `snapshotOp` becomes a registered op
  `theme-editor:snapshot` with args `{ prev, next, coalesceKey }`.
- `useLabHistory` takes an optional `{ load(): SerializedHistory | null; save(h): void }`.
  - `PaletteLab` saves beside `LIVE_KEY` (`presets.ts`), as `weasel.theme-editor.live.history`.
  - `ThemeWorkbench` saves beside its draft (`loadDraft` in `ThemeEditor.tsx`), keyed by theme name.
  - Discarding a draft clears its saved history.
- Staleness: save the history together with the state it ends on. On load, restore only if that
  final state equals the loaded state (`sameJson`).
- Tests: a reload keeps undo and redo for both surfaces, a discarded draft starts empty, and a
  history saved against different state is dropped.

## Finish

- Each step is its own commit, with `patch` changesets for `@weasel-js/labkit` (Steps 1–2). The
  theme editor is an app and gets no changeset.
- Retire or rewrite any `docs/TODO.md` entry about labkit undo persistence. Find one with
  `grep -n -i 'undo' docs/TODO.md`.
- Scoped tests run locally, one file at a time with `--maxWorkers=1`. Then one batch fleet run
  (`npm run test:fleet` plus `test:fleet:postbuild`) on the branch tip, then fast-forward `main`.
  Then delete this plan.
