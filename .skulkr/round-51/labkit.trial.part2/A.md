# Audit round 51 — labkit.trial.part2 — findings

## Canvas layers the layer list does not name jump below every listed layer after the first reorder
- where: packages/labkit/src/trial/useTrialLayers.ts:42-44 (useTrialLayers, `canvasLayers`)
- scenario: an instrument declares `canvas.layers` [bg, grid, shapes, overlay] and `layers.ids` [grid, shapes] (the
  capability is "which of an instrument's layers the trial should offer show/hide controls for", so a subset is the
  normal case). `layerOrder` is only ever written by `TrialLayerList.onReorder` as `moveLayers(items).map(id)`, i.e.
  the listed ids only. After the user drags shapes above grid, `layerOrder` is [shapes, grid]; the sort comparator
  `layerOrder.indexOf(a.id) - layerOrder.indexOf(b.id)` gives bg and overlay -1, so the canvas now draws
  bg, overlay, shapes, grid — the unlisted `overlay` that was drawn on top of everything now draws under the content.
  Should: keep unlisted layers at their declared place (sort only the listed ones among the slots they occupy, or
  rank a missing id by its declaration index). `layerItems` (line 74-76) has the same -1 comparator, harmless there
  only because its items are exactly the ids `layerOrder` was written from.
- evidence: read (TrialLayerList.tsx:24 writes the order from list items only; instrument/types.ts:180-186)
- severity: medium

## `RenderContext.trial.setZoom` answers zoom differently from the trial chrome's setZoom: unclamped and about the world origin
- where: packages/labkit/src/trial/useTrialCamera.tsx:132-135 (useTrialCamera, `setZoom`)
- scenario: a canvas/stage instrument with `maxZoom: 4` calls `ctx.trial.setZoom(20)` (or a value below `minZoom`).
  `withZoom(view2d, z)` is `normalize2DView({ zoom, pan: view.pan })`: no clamp to the instrument's range, and with
  `pan` kept the zoom pivots about world (0,0)'s screen position, not the view's middle. The chrome's zoom for the same
  trial (useTrialChromeContext.ts:129-131, via `zoomCameraTo`) clamps to `camera.zoomRange()` and zooms about
  `viewMiddle`, and the orbit branch of this very function clamps (`orbitZoomView.set` → `clampCamera`). So the same
  request lands the view at 20× pivoted off-screen from the instrument, but at 4× centered from the title bar. Should:
  one pathway — route the 2D case through the registered `CameraView`/`zoomCameraTo` as the chrome does.
- evidence: read (state/view.ts:76-78, canvas/cameraZoom.ts:17-21, canvas/orbitZoom.ts set)
- severity: medium

## The first cross-redo check after a reload drops both histories' saved redo
- where: packages/labkit/src/trial/useTrialUndo.ts:37-47 (useCrossRedo)
- scenario: a trial whose instrument declares `undo` and `annotations`. The user makes a mark edit and a state edit,
  undoes one of them (so a redo is saved — `savedUndo.ts` keeps `redoStack`, and the mark store's `toJSON` writes its
  history beside the scenes), and reloads. On mount `high` is `-Infinity`; `snapshots` is undefined until
  `useRestoredHistory`'s effect sets the restored history, then the effect re-runs with `steps` defined and calls
  `check()`. With `before = -Infinity`, any restored undo stamp on either side is "later than any either side has
  shown", so `steps.dropRedo()` and/or `marks.dropRedo()` run: the redo the user saved is gone although no new change
  was made. The same happens on first mount for an instrument's own mounted history restored by `useHeldOwnHistory`.
  Should: seed `high` from the stamps present when the pair is first seen (or only count stamps that rise after the
  first observation), so restored stacks are not read as new edits.
- evidence: read (trialUndo.ts trialSteps; state/savedUndo.ts:28,46,76; useRestoredHistory.ts)
- severity: medium

## An instrument history that mounts again while its trial stays open starts empty, and the next save writes that
- where: packages/labkit/src/trial/useRestoredHistory.ts:71-76 (useHeldOwnHistory)
- scenario: a trial is read with `undo.own = S`. The instrument's history source A mounts; this effect restores S into
  A and adds S to the module-level `restored` set; the user makes edits on A. The instrument then unmounts the
  component that owns its `useTrialHistory` and mounts it again (a mode switch, a scene keyed by a setting) while the
  trial stays open: A's release parks A's serialized form (ownUndo.ts `parked`), then `holdOwnUndo(B)` for the new
  source B calls `unpark`, discarding it. This effect sees `saved` is still S, already in `restored`, and returns
  without restoring anything into B. B is empty, `ownUndoOf` now answers B's empty form, and the next save writes it:
  both the read history and the session's edits are gone, and Undo is dead. Should: a newly held source takes what was
  parked (or the last saved form) as its restore, rather than restoring only the first source per read.
- evidence: read (state/ownUndo.ts holdOwnUndo/unpark; state/bindLabStore.ts:29 saves through ownUndoOf; record.undo.own
  is only the value the record was read with)
- severity: medium

## A config write to an `over` path that ends where it started leaves an empty undo step; a trial path takes it back
- where: packages/labkit/src/trial/useTrialWrites.ts:126-135 (useTrialWrites, `apply`, over branch)
- scenario: a slider on a path of the schema the config is drawn over (`writesOver(schema, path)`) is dragged 5 → 7 →
  5 as drafts, then settled with `setConfig(path, 5)`. The first draft records a `stateOp` entry; the return to 5
  never runs `takeBackIfUnchanged` (that call is only on the trial branch, line 170, and the over branch's gesture has
  `start: null` because an `op` was passed), and the settling write is dropped by the `deepEqual(read(), value)` early
  return. Undo then spends a step that changes nothing. The same gesture on a trial's own config path is taken back
  ("A gesture back where it started has made no step"). Should: one rule for both branches — compare the over value
  with the one the gesture started from and take the entry back the same way.
- evidence: read (useWriteGestures.ts:73-78 `start` is null whenever `op` is given; :87-95)
- severity: low

## Files read
packages/labkit/src/trial/useKeptMarks.ts
packages/labkit/src/trial/useOrbitView.tsx
packages/labkit/src/trial/useRestoredHistory.ts
packages/labkit/src/trial/useRuntimeSections.tsx
packages/labkit/src/trial/useTrialCamera.tsx
packages/labkit/src/trial/useTrialChromeContext.ts
packages/labkit/src/trial/useTrialClock.ts
packages/labkit/src/trial/useTrialConfig.ts
packages/labkit/src/trial/useTrialContributions.ts
packages/labkit/src/trial/useTrialDragDrop.tsx
packages/labkit/src/trial/useTrialEdits.ts
packages/labkit/src/trial/useTrialJob.ts
packages/labkit/src/trial/useTrialLayerStack.tsx
packages/labkit/src/trial/useTrialLayers.ts
packages/labkit/src/trial/useTrialMarks.ts
packages/labkit/src/trial/useTrialOrbit.ts
packages/labkit/src/trial/useTrialPanels.ts
packages/labkit/src/trial/useTrialSnapshot.ts
packages/labkit/src/trial/useTrialTool.ts
packages/labkit/src/trial/useTrialToolSlot.ts
packages/labkit/src/trial/useTrialUndo.ts
packages/labkit/src/trial/useTrialWrites.ts
packages/labkit/src/trial/useViewPlacement.ts
packages/labkit/src/trial/useWriteGestures.ts
packages/labkit/src/trial/watch3d.ts
packages/labkit/src/trial/writeGesture.ts

<!-- done: 5 findings, files read: 26 -->
