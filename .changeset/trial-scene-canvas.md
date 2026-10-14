---
'@weasel-js/labkit': patch
---

A weasel scene can be a trial's subject. `<TrialSceneCanvas>` is a `<SceneCanvas>` that fills an instrument's trial and takes part in it: the trial's tool palette and the canvas's active tool are one value, moved by either, and the trial's Undo and Redo, buttons and Mod+Z alike, step the scene's own history. `useTrialScene(ctx, create)` builds the scene once per trial and keeps it in the trial's `state.scene`, so persistence, Reset, Clone, and snapshots carry it, loading any change from outside into the same `Scene`. `SceneTrialState` is that state's shape.

`useTrialHistory(source)` hands a trial any history an instrument keeps itself — `canUndo`, `canRedo`, `undo`, `redo`, and `subscribe`. While one is mounted, the trial's Undo and Redo step it and `setState` stops snapshotting `state`; the buttons still come from declaring `undo`. `RenderContext.trial` gains `setActiveTool`, which writes the slot `activeToolId` reads.

The weasel-lab, minimal, and drag-lab examples are rebuilt on these, and no longer push every scene mutation through labkit's snapshot stack.
