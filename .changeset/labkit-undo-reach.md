---
'@weasel-js/labkit': patch
---

A trial's undo now hears every write to it. A settings change in a trial whose instrument hands over a history of its own (`<TrialSceneCanvas>`, `useTrialHistory`) goes onto that history, in order with the instrument's edits; before, it was recorded on a stack nothing stepped, and could not be undone. `TrialHistorySource` gains a required `record(op, label)` for this, which breaks a history passed to `useTrialHistory` without one.

`useTrialState().setConfig` and `setState`, inside a trial, are now the trial's own writers: undo records them and `setConfig` runs the instrument's `onConfigChange`, where both used to write the store directly.

Reset and loading a snapshot start the trial on a fresh undo history, as Clone already did, and as a scene's history already was on Reset. Before, the first undo after either stepped back past the last change made before it.
