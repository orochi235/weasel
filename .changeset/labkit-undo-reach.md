---
'@weasel-js/labkit': patch
---

A trial's undo now hears every write to it. A settings change in a trial whose instrument hands over a history of its own (`<TrialSceneCanvas>`, `useTrialHistory`) goes onto that history, in order with the instrument's edits; before, it was recorded on a stack nothing stepped, and could not be undone. `TrialHistorySource` gains a required `record(op, label)` for this, which breaks a history passed to `useTrialHistory` without one.

`useTrialState().setConfig` and `setState`, inside a trial, are now the trial's own writers: undo records them and `setConfig` runs the instrument's `onConfigChange`, where both used to write the store directly.

Reset and loading a snapshot start the trial on a fresh undo history, as Clone already did, and as a scene's history already was on Reset. Before, the first undo after either stepped back past the last change made before it.

A trial leaves Mod+Z and Shift+Mod+Z alone when it has nothing to step, as `useUndoKeys` already did, so a lens or any other handler further out still gets the chord; before, a trial with Undo buttons took it either way.

`useTrialScene` no longer reloads its scene from an older JSON it wrote itself. Two scene edits between a render and its effect left that render holding the first edit's JSON, which the hook read as an outside write and loaded, undoing the second.
