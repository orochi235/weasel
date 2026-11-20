I couldn't write the findings file (the write to `.skulk/out/findings.md` was refused), so the whole document is below instead of in the file.

# Audit round 50 — labkit.part2

## A Reset or outside load of a scene that has history writes a scene with no nodes into the trial's state
- where: packages/labkit/src/scene/useTrialScene.ts:49-55 (the `scene.history.observe` effect), together with :59-73 (the `stored` effect)
- scenario: A trial using `useTrialScene` takes one edit, so the scene's history is non-empty. Then the user presses Reset, or another tab writes `state.scene`. The effect calls `scene.loadState(json)`, which works in this order (packages/core/src/core/scene/scene.ts:228-231):
  1. `doc.reset(...)` runs `state.nodes.clear()` (sceneState.ts:88).
  2. `recording.clearHistory()` calls `engine.clear()`, which emits a `'clear'` step synchronously (history.ts:107, versionClock.ts:26).
  3. Only after that does `edits.construct(specs)` rebuild the nodes.

  The observer skips only `'restore'` steps. On the `'clear'` step it calls `scene.toJSON()` on the emptied scene, stores that JSON in `known.current` and writes it to `state.scene`. On the next render `stored === known.current`, so the effect returns and nothing corrects the state. The canvas shows the loaded nodes, but the persisted state holds a scene with no nodes, and so do Clone, snapshots and the other tab through sync. After a reload the trial opens empty.
  It should skip `'clear'` (and the other steps that only change the stacks), or write back only once the load has finished. The test at TrialSceneCanvas.test.tsx:151 checks only the live scene, never `state.scene`.
- evidence: read (traced through core's scene.ts, sceneState.ts, history.ts and versionClock.ts; not run)
- severity: high

## `sceneTrialHistory.restore` throws `ExtensionConflictError` on every restore after the first on the same scene
- where: packages/labkit/src/scene/sceneTrialHistory.ts:91-94 (`restore`)
- scenario: Each call to `restore` builds a new `{ apply, revert }` object and passes it to `scene.registerOp(TRIAL_EDIT_OP, …)`. The op table returns early only when it is handed the *same* handler object. A different one with no `replace` flag throws `ExtensionConflictError` (packages/core/src/core/scene/opTable.ts:109-111).
  The trial calls `restore` once for each saved object it reads (`useHeldOwnHistory`, useRestoredHistory.ts:71-75, whose module-level `restored` WeakSet is keyed on that object). Per the `TrialHistorySource.restore` contract, that happens when the lab opens *and* whenever another tab writes the trial. So the second time another tab writes a scene trial with saved undo, the effect throws and the trial's history is never restored. A remount that hands over a newly read record does the same. The handler should be registered once per scene, or with `{ replace: true }`. No test calls `restore` twice.
- evidence: read
- severity: high

## The overview draws animated (`timed`) canvas layers once and never repaints them
- where: packages/labkit/src/overview/TrialOverview.tsx:232-243 (`LayersCanvas`)
- scenario: A canvas instrument has a layer with `timed: true`, which `useTrialLayers` passes through (trial/useTrialLayers.ts:48). The stack's scheduler repaints such a layer on every tick of the trial clock (canvas/useLayerScheduler.ts:93-95). `LayersCanvas` redraws only when `layers`, `fit`, `size`, `yDir` or `dpr` change, and it never looks at `layer.timed`. So the overview keeps the first frame of an animated layer while the stage animates. The two re-drawers of the same layers disagree on when a layer is stale.
- evidence: read
- severity: low

## The scene's trial history has no `clear`, so a Reset over a scene not owned by `useTrialScene` keeps stale settings entries
- where: packages/labkit/src/scene/sceneTrialHistory.ts:57-100 (the returned source has no `clear`)
- scenario: `TrialHistorySource.clear` is documented as what the trial calls on Reset or when a snapshot is loaded over the trial. The interface itself says that without it "the settings entries the trial recorded here stay on the stack and write nothing" (trial/trialHistory.ts:43-46). `sceneTrialHistory` puts the trial's settings entries onto the scene's stack but never implements `clear`. It relies on `useTrialScene`'s `loadState` to clear the stack as a side effect. A `<TrialSceneCanvas>` handed a scene that does not come from `useTrialScene` (the prop allows this: "useTrialScene's, usually"), or a load whose `state.scene` comes back as the same object, keeps the old entries after Reset. Undo then steps through entries that write nothing.
- evidence: read
- severity: low

## Files read
packages/labkit/src/overview/TrialOverview.tsx
packages/labkit/src/overview/index.ts
packages/labkit/src/passthrough/weasel-canvas.ts
packages/labkit/src/pbt.fixture.ts
packages/labkit/src/scene/TrialSceneCanvas.less
packages/labkit/src/scene/TrialSceneCanvas.tsx
packages/labkit/src/scene/index.ts
packages/labkit/src/scene/sceneResets.ts
packages/labkit/src/scene/sceneTrialHistory.ts
packages/labkit/src/scene/useSceneCamera.ts
packages/labkit/src/scene/useSceneToolSlot.ts
packages/labkit/src/scene/useTrialScene.ts
packages/labkit/src/styles.dev.ts
packages/labkit/src/styles.less
packages/labkit/src/test-setup.ts
packages/labkit/src/testing/lab.ts
packages/labkit/src/testing/lens.ts
packages/labkit/src/testing/liveTest.ts
packages/labkit/src/theme/Interstellar.stories.less
packages/labkit/src/theme/Interstellar.stories.tsx
packages/labkit/src/theme/base.less
packages/labkit/src/theme/index.ts
packages/labkit/src/theme/interstellar.ts
packages/labkit/src/tools/labTool.ts
packages/labkit/src/tools/types.ts
packages/labkit/src/undo/editStamp.ts
packages/labkit/src/undo/index.ts
packages/labkit/src/undo/stateOp.ts
packages/labkit/src/undo/useUndoKeys.ts
packages/labkit/src/vite/index.ts
packages/labkit/src/vite/labRoutes.ts

<!-- done: 4 findings, files read: 31 -->