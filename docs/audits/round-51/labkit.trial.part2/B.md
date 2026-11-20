# Audit round 51 — labkit.trial.part2 — blind reviewer findings

## The trial chrome context is rebuilt on every render, because `view2d` is a fresh object each time
- where: packages/labkit/src/trial/useTrialChromeContext.ts:115 (useTrialChromeContext)
- scenario: `chromeView(record.view)` calls `as2DView`, which always constructs a new `{ zoom, pan }` object (state/view.ts:17, `normalize2DView` returns that new object). `view2d` is a dependency of the `useMemo` at line 128, so the memo misses on every render of the trial, even when nothing changed, and every region reading the `TrialChromeContext` re-renders with it. The file goes out of its way to keep identity stable elsewhere (`NO_SECTIONS`, "keeps a stable context identity across renders"), so the memo is meant to hold. Should depend on `record.view` (already covered by `record`) and derive `view2d` inside the memo.
- evidence: read
- severity: low

## A layer toggle or reorder records an undo step that cannot undo it: layer order and visibility live outside the snapshot
- where: packages/labkit/src/trial/useTrialLayerStack.tsx:29 (useTrialLayerStack, via `useTrialLayerState` in TrialLayerList.tsx:35-38)
- scenario: an instrument lists `undo: { snapshotOn: ['layers.toggle'] }` (the case `Trial.canvas.test.tsx:245` covers). Unchecking "Show grid" calls `snapshot('layers.toggle')`, which pushes the trial's *state* onto the snapshot stack, then writes visibility into React `useState` that no snapshot holds. Undo is enabled, but pressing it restores an identical state and the grid stays hidden; the step is a no-op, and a second Undo then undoes an unrelated earlier edit. The same for `layers.reorder`. The test checks only that Undo became enabled, never that it restores the layer. Either layer state goes into what the snapshot captures, or these events stop being offered as snapshot events.
- evidence: read
- severity: medium

## A canvas layer not named in `layers.ids` jumps to the bottom of the stack after the first reorder
- where: packages/labkit/src/trial/useTrialLayers.ts:43 (useTrialLayers, `canvasLayers`)
- scenario: `canvas.layers = [bg, grid, hud]`, `layers.ids = ['grid', 'hud']`. After any drag in the list, `layerOrder = ['hud', 'grid']` (built from the list's items, which are `layers.ids` only). The sort compares `layerOrder.indexOf('bg') = -1` against 0 and 1, so `bg` sorts first — here harmless, but with `canvas.layers = [grid, hud, overlay]` and `overlay` not listed, `overlay` goes from drawn last (on top) to drawn first (underneath everything). `packages/labkit/src/layers/AGENTS.md:23-24` promises "A canvas layer not in `layers.ids` keeps its default order". Unlisted ids need their base index kept (e.g. sort only the listed ones into the listed slots).
- evidence: read
- severity: low

## An `alwaysOn` layer is drawn hidden when visibility says false, while the list shows it on
- where: packages/labkit/src/trial/useTrialLayers.ts:34,47 (useTrialLayers, `visibleLayers` / `canvasLayers`) vs :85 (`layerItems`)
- scenario: the same question, "is this layer shown?", is answered two ways: `layerItems` forces `visible: true` for `alwaysOn`, but `visibleLayers` and `canvasLayers[].visible` read `layerVisibility` alone and never consult `alwaysOn`. `layers/AGENTS.md:31` says an `alwaysOn` layer "always renders, whatever `visibility` says". Any `false` reaching `layerVisibility` for that id (a bulk visibility change from `LayerList` that includes every row, or an instrument revision that marks a layer `alwaysOn` after the user hid it in the same session) leaves the canvas not drawing a layer whose list row shows it on with no checkbox to turn it back.
- evidence: read (the path by which a `false` arrives is inferred, not reproduced)
- severity: low

## The tool slot's chrome memo never holds: `setActiveTool` is a new closure every render
- where: packages/labkit/src/trial/useTrialTool.ts:30 (useTrialTool) → packages/labkit/src/trial/useTrialToolSlot.ts:26-29 (useTrialToolSlot)
- scenario: `useTrialTool` passes an inline `(id) => declaresTools ? setTrialTool(...) : setLabTool(id)` as `setActiveTool`, so it is a fresh function on every render. `chrome` lists `setActiveTool` as a memo dependency, so it is a new object every render, and it is `toolSlot` in `useTrialChromeContext`'s memo deps (useTrialChromeContext.ts:177), which therefore misses every render too. `useTrialToolSlot`'s doc says a same-keys report "keeps the last, so a canvas re-reporting its keys does not re-render the chrome"; the chrome re-renders anyway, since the context it reads is replaced on every trial render. Needs a stable setter (`useCallback` over `declaresTools`, `record.id`, and the two store actions).
- evidence: read
- severity: low

## A saved trial history is marked restored before `enabled` is checked, so it is lost if the instrument gains `undo` later
- where: packages/labkit/src/trial/useRestoredHistory.ts:41-44 (useRestoredHistory)
- scenario: the trial's record was read with `undo.trial` saved, but the instrument as first mounted has no `undo` capability (`enabled` false). The effect adds `saved` to `restored` and only then returns on `!enabled`. When the instrument is swapped under the live trial for a revision that declares `undo` (a case `useTrialMarks.ts:63` says happens: "The instrument can be swapped under a live trial"), `enabled` flips true and the effect reruns, but `restored.has(saved)` returns early and the saved history is never restored; the next snapshot builds an empty history and the next save overwrites the saved one. The `enabled` check belongs before marking.
- evidence: read (the swap path is inferred from the comment, not reproduced)
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

<!-- done: 6 findings, files read: 26 -->
