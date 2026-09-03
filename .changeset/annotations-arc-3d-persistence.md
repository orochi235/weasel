---
'@weasel-js/labkit': patch
---

Marks persist, undo takes them back, and a mark can say what it means. Closes
the `annotations` capability.

`TrialRecord.annotations` is where a trial's marks are kept — written on a
trailing debounce and flushed on unmount, so the last mark before a close is
not lost. The field is optional and additive: a document written before this
change lacks it and needs no migration. An instrument that would rather own its
marks declares `annotations.storage` with a `load`/`save` pair, and labkit
never touches its own slot.

Undo is routed to weasel history rather than reimplemented. Each target's marks
live in their own scene with its own stack, so `AnnotationsApi` grows
`undo` / `redo` / `canUndo` / `canRedo`, which take back the most recent change
wherever it was made. Declaring `annotations` now earns the trial's undo and
redo buttons whether or not the instrument also declares `undo`; a trial
declaring both takes the marks first.

A `Marks` sidebar panel (`<MarkList>`) lists every mark with its kind, its
target, an editable title, a status picker and a staleness badge.
`AnnotationStatus` gains a `color`, which the mark on the canvas follows; a
mark whose target's declared config keys have moved draws dashed rather than
hidden, because it still describes something.
