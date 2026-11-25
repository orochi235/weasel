TODO and PERF are unchanged: this was report-only. I couldn't save the findings to `.skulk/out/findings.md` because the write was denied, so the whole document is below.

# Audit round 51 — labkit.trial.part1

## Undo steps recorded for layer show/hide and reorder bring nothing back
- where: packages/labkit/src/trial/TrialLayerList.tsx:23,27 (TrialLayerList)
- scenario: an instrument lists `'layers.toggle'` or `'layers.reorder'` in `undo.snapshotOn`. The changelog for e748d97 and `docs/guides/1-recipes.md` promise an undo step for these. The user hides a layer and presses Undo. `snapshot('layers.toggle')` recorded a `trialEditOf(current, 'edit')` entry, which holds only the record's `state`, `config` and `auto`. Layer visibility and order live in React state (`useTrialLayerState`), and no entry captures them. Undo writes back an unchanged state/config and the layer stays hidden, so the press is spent on a step that does nothing. Redo is equally empty. If the instrument has mounted its own history, `snapshot` returns false for these events and records nothing at all. The step should capture and restore `layerVisibility`/`layerOrder`.
- evidence: read
- severity: medium

## A seed value for a path the schema starts auto is silently ignored
- where: packages/labkit/src/trial/trialOps.ts:74 (addTrial), also :129 (resetTrial)
- scenario: a schema declares `cols` with `.initial(AUTO)`, and the caller runs `addTrial(trials, instruments, 'Schemed', { config: { cols: 3 } })`. `autoPaths` is built as the schema's auto paths plus the seed's AUTO paths, and an explicit seed value never removes a path from that set. The record ends up with `config.cols = 3` and `auto: ['cols']`. Auto wins on read (`resolveAutoConfig` / `startAutoPathsOf`), so the trial runs the auto value instead of the subject it was opened on. That breaks the `AddTrialOptions.config` promise ("running that subject from its first frame"). It also disagrees with `setConfig`, where an explicit write pins the path (see `changesNothing` and `applyConfigWrite`). `initialState(config)` sees `cols = 3` while render sees the auto value, so one trial reads the same setting two ways. Reset repeats the problem. Paths the seed sets explicitly should be removed from the schema's auto set.
- evidence: read
- severity: medium

## A `dragDrop` instrument without a `canvas` shows its palette, but nothing can be dropped
- where: packages/labkit/src/trial/trialContent.tsx:61-62 (renderTrialContent)
- scenario: an instrument declares `stage` (or `orbit`, or no camera) together with `dragDrop`. `useTrialDragDrop` still builds the palette and `useRuntimeSections` puts it in the chrome, so the user can start a drag. But `dragDrop.target` and `<DragOverlay>` are mounted only on the `camera?.kind === 'canvas'` path, and lines 61–62 drop both. The drag shows no overlay and `onDrop` is never called. Neither `DragDropCapability`'s docs nor any instrument validation says drag-and-drop needs a canvas, so it fails with no warning. The target and overlay should be mounted for every camera, or the combination rejected.
- evidence: read
- severity: medium

## An undocked sidebar section loses `fill`
- where: packages/labkit/src/trial/UndockedSections.tsx:35-43 (Portalled)
- scenario: a section declares `fill: true`, meaning "take the pane's spare height and hold the body to it, so the body scrolls a part of itself" (forge's CSS Vars list, f54a074eb9). Docked, `SidebarRegion` passes `fill={item.fill}`. When the user tears it out into a workspace panel, `Portalled` rebuilds the `<Section>` without `fill`. The body then grows to its content height instead of filling the panel and scrolling inside it, so the part meant to scroll is cut off or pushes the rest out of view. `fill` was added to `SidebarRegion` after `UndockedSections` was last touched (2026-10-25), and this path never got it.
- evidence: read
- severity: low

## `MissingTrial`'s close button stays enabled on the last trial, where it does nothing
- where: packages/labkit/src/trial/MissingTrial.tsx:13 (MissingTrial)
- scenario: a saved lab's only trial names an instrument that was since renamed, so `<Trial>` renders "Unknown instrument: …" with a close button. Pressing it calls `lab.closeTrial(id)`. That command defers to `closeTrialOp`, which keeps the last trial, so nothing happens. The button gives no disabled state or reason, and the tile offers no other way out. The chrome answers the same question differently: its close is `disabled: ctx.isLastTrial` (`chrome/trialActions.tsx:106`). The fallback should disable the button on the last trial, or offer a swap.
- evidence: read
- severity: low

## `trialHistoryOf` drops the save/restore that `History` supports, so a trial loses its undo on reload by mounting one
- where: packages/labkit/src/trial/trialHistoryOf.ts:5-17 (trialHistoryOf)
- scenario: an instrument mounts `useTrialHistory(trialHistoryOf(history))`, as `examples/3d-lab/SolidInstrument.tsx` and the README do. The weasel `History` has `serialize()` and `restore(snapshot, { rebuildOp })`, but the adapter supplies neither `serialize` nor `restore`. The trial's settings entries now go onto this history instead of its own snapshot history, which is saved and restored. So on reload, every undo step for state and settings is gone. Without mounting the adapter, the same trial would keep them across reloads.

  It also stamps steps with `entry.timestamp`, which is a whole millisecond. Marks use the fractional `editStamp()`, and `sceneTrialHistory` switched to `editStamp` for exactly this reason. With two changes in the same millisecond, `trialUndoBindings` can therefore order a mark ahead of a later step.
- evidence: read
- severity: low

## Files read
packages/labkit/src/trial/FloatSidebar.tsx
packages/labkit/src/trial/MissingTrial.tsx
packages/labkit/src/trial/Trial.less
packages/labkit/src/trial/Trial.stories.tsx
packages/labkit/src/trial/Trial.tsx
packages/labkit/src/trial/TrialBody.tsx
packages/labkit/src/trial/TrialChrome.tsx
packages/labkit/src/trial/TrialContexts.tsx
packages/labkit/src/trial/TrialDragContext.ts
packages/labkit/src/trial/TrialLayerList.tsx
packages/labkit/src/trial/TrialScope.tsx
packages/labkit/src/trial/TrialTheme.tsx
packages/labkit/src/trial/TrialTitleBar.tsx
packages/labkit/src/trial/UndockedSections.tsx
packages/labkit/src/trial/homeView.ts
packages/labkit/src/trial/index.ts
packages/labkit/src/trial/loupeSwitch.ts
packages/labkit/src/trial/renderContext.ts
packages/labkit/src/trial/trialConfigChange.ts
packages/labkit/src/trial/trialContent.tsx
packages/labkit/src/trial/trialEdit.ts
packages/labkit/src/trial/trialEditOp.ts
packages/labkit/src/trial/trialHistory.ts
packages/labkit/src/trial/trialHistoryOf.ts
packages/labkit/src/trial/trialOps.ts
packages/labkit/src/trial/trialTitle.ts
packages/labkit/src/trial/trialUndo.ts

<!-- done: 6 findings, files read: 27 -->