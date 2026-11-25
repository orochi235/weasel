# Audit round 66 — labkit.trial.part2

## A trial with no camera shows a live zoom control whose writes put a 2D view into the record
- where: packages/labkit/src/trial/useTrialChromeContext.ts:63 (chromeView), :124-134 (setZoom / zoom)
- scenario: an instrument declaring none of `canvas`, `stage`, `orbit` (`cameraOf` → null, so nothing ever publishes a camera) keeps `record.view === null`. `chromeView(null)` answers `DEFAULT_VIEW`, so the chrome reports `zoom: 1` instead of `null` and offers the zoom controls; each zoom step runs `writes.updateTrialView(trialId, withZoom(DEFAULT_VIEW, z))`, writing a 2D view nobody draws and the readout then tracks. The same null view in an orbit trial before `Orbit`'s publish effect runs takes the same path. `useTrialCamera` answers the same view the other way (`as2DView(view)` with no null fallback, `setZoom` a no-op), so the two places disagree. The `null → DEFAULT_VIEW` fallback should apply only where the trial's camera is a 2D one (`canvas`/`stage`).
- evidence: read (homeView.ts `cameraOf` returns null without canvas/stage/orbit; `usePublishCamera` is called only from CameraInput, Orbit, useSceneCamera)
- severity: low

## Marks kept in an instrument's own storage are never reloaded when the storage changes, so the next save overwrites the new storage with the old marks
- where: packages/labkit/src/trial/useKeptMarks.ts:12-30 (useKeptMarks); packages/labkit/src/trial/useTrialMarks.ts:76-79, 149-152
- scenario: `useTrialMarks` notes the instrument "can be swapped under a live trial" and reads the capability through a ref for that reason. When the new instrument's `annotations.storage` differs, `useKeptMarks` keeps its `loaded` from the old storage (the effect returns as soon as `loaded` is set, and nothing resets it on a `storage` or `trialId` change), and the mark store built at mount from the old marks stays. `useSavedMarks`, though, re-subscribes with the new `saveCap`, so the first mark edit saves the old storage's marks plus the edit into the new storage, overwriting what it held. Reset `loaded` (and rebuild the store) when `storage` changes.
- evidence: read
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

<!-- done: 2 findings, files read: 26 -->
