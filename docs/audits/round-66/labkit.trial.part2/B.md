# Audit round 66 — labkit.trial.part2

## useKeptMarks keeps the first storage's marks when the instrument's storage changes, and the trial then saves them into the new storage
- where: packages/labkit/src/trial/useKeptMarks.ts:12-30 (useKeptMarks)
- scenario: a live trial's instrument is swapped (useTrialMarks notes "the instrument can be swapped under a live trial") from one whose `annotations.storage` is A to one whose storage is B. `loaded` is already set from A, so the effect's `if (!storage || loaded) return` never loads B; `ready` stays true, so `Trial.tsx` keeps `TrialRuntime` mounted with A's value. `useTrialMarks` keeps its store, and `useSavedMarks` reads `annotationsCap.storage` live, so the next debounce writes A's marks over whatever B held. The same stale value is kept when `trialId` changes. Should: reset `loaded` (or key the state) on `storage`/`trialId` identity, loading the new storage's marks or taking them from the preload.
- evidence: read (Trial.tsx:43,52 gates only on `ready`; useTrialMarks.ts:149-153 reads storage per render)
- severity: low

## The trial's config history is created without `rebuild`, unlike the restored one
- where: packages/labkit/src/trial/useTrialSnapshot.ts:124 (snapshot)
- scenario: a trial with no saved undo records its first entry, so `snapshot` makes `trialUndoHistory(maxDepth)` with no `rebuildOp`; a trial that loaded with saved undo gets `trialUndoHistory(maxDepth, rebuild)` (useRestoredHistory.ts:48). Any later `restore()` on the first one (it has no restore-time `rebuildOp` from this file) cannot rebuild `TRIAL_EDIT_OP` entries, so the question "how does this trial's history rebuild its entries" is answered two ways depending on whether the lab loaded with a saved history. Should: pass `rebuild` here too.
- evidence: read; whether any caller restores into a live `record.history` is inferred, not traced (useRestoredHistory skips when `record.history` exists)
- severity: low

## watch3d schedules its retries with a computed `setTimeout` delay rather than `after`
- where: packages/labkit/src/trial/watch3d.ts:15-16 (findTrial)
- scenario: `setTimeout(() => findTrial(...), wait)` where `wait = RETRIES_MS[attempt + 1]`. The values are bounded today, so nothing misfires, but CLAUDE.md requires a timer whose delay is not a constant to wait through `after`, and `check:timers` targets exactly this shape. Should: `after(wait, ...)`.
- evidence: read
- severity: low

## WebGPU watch holds every canvas a device ever configured, strongly, for the device's life
- where: packages/labkit/src/trial/watch3d.ts:104,134-136 (installGpuDepthWatch)
- scenario: in development, a long-lived `GPUDevice` that configures canvases for trials that are then closed (or a view that recreates its canvas on each remount) adds each one to `gpuCanvases.get(device)`, a strong `Set<Element>`. Detached canvases, and the trial DOM they still point at through their parents until removed, are never released while the device lives. Should: hold them weakly (a `WeakRef` set, or drop disconnected ones when the set is walked).
- evidence: read
- severity: low

## A canvas whose depth testing turns on before it joins a trial is never reported
- where: packages/labkit/src/trial/watch3d.ts:78-83, 107-113 (installDepthWatch, gpuFound)
- scenario: a hand-written WebGL view builds its canvas offscreen, calls `gl.enable(DEPTH_TEST)`, and appends the canvas to the trial more than 1.3 s later (or appends it to a connected container outside the trial and moves it in). `depthSeen` is marked on the first `enable`, `findTrial` gives up after its retries (or finds no `[data-trial-id]` ancestor and returns), and later `enable` calls are skipped as already seen, so the undeclared-orbit warning and title-bar mark never appear. Should: mark `depthSeen` only once a trial was found.
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

<!-- done: 5 findings, files read: 26 -->
