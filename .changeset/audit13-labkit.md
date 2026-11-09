---
'@weasel-js/editor': patch
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
'@weasel-js/history': patch
'@weasel-js/core': patch
---

Fixes to the editor's page stepping, forge's API panel, and labkit's job readout and undo across marks and settings.

- `usePages().step` steps from the page the view is on or was last on. Before, from the gap between pages the next page was always the first and the previous one always the last. A view that has never been on a page steps to the first page either way, and `add` puts a new page after the last one there rather than after page 1. `shown` still falls back to the first page.
- forge's API panel escapes a quote inside a string literal type it prints from TypeDoc's JSON (an overload's signature), showing `'it\'s'` rather than `'it's'`.
- `<JobProgress>` sizes its count for the job's total, so the failure count and Cancel button after it stay put as the count gains digits.
- A new change to a trial's marks drops what its settings, state or scene history could redo, and a new change there drops what the marks could redo. Before, Redo could reapply an undone mark over a later settings change, or the reverse. A `TrialHistorySource` without `undoStamp` and the new optional `dropRedo` keeps the old behavior. `AnnotationsApi` gains `dropRedo`.
- `<TrialSceneCanvas>` stamps its scene's edits on the same clock as the marks, so a scene edit and a mark made in the same millisecond undo and redo in the order they were made.
- `History.dropRedo()` (and `scene.history.dropRedo()`) takes the redo stack away and keeps the undo stack, as a push does: a branching history keeps it as a branch, any other evicts it. `History.observe` reports it as a `'drop'` step. A `History` implemented outside weasel needs the new method.
