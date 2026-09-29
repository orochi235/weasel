---
'@weasel-js/labkit': patch
---

Selecting a mark in one annotation target now clears the selection in the trial's other targets. This changes the default: before, each target kept its own selection, so clicking in one left a selection standing in another and `selection()` reported both. An instrument wanting the old behavior declares `annotations: { selection: 'per-target' }` (also accepted by `createAnnotationStore`, as a value or a thunk); the new `AnnotationSelectionMode` type names the two modes. Under the default, `setSelection` keeps only the ids in the first id's target. A selection change that touches several targets — a click that clears another, or a `setSelection` spanning several — now reaches `subscribe` as one event, fired once every target has its final selection.
