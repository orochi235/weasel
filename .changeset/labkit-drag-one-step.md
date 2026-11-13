---
'@weasel-js/labkit': minor
---

A slider dragged in a trial's settings is one undo step however long the drag pauses, and two quick drags are two.

A chrome contribution's context carries the trial's `draftConfig`, which a `<ControlPanel>` of your own takes beside `setConfig` to record its edits the same way.

<!-- entry: fix api -->
