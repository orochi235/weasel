---
'@weasel-js/ui': patch
---

`LayeredCurveEditor` reports an undo or redo of its built-in history as a finished change: `onLayerCommit(id, restored, current)` after `onLayerChange`, so `CurveEditor` now calls `onChange` for them. A consumer that keeps its own undo, or builds ops from `onLayerCommit`, turns `history` off or records each step twice.

A `CurveLayer` may define `onContextMenu`, dispatched to the topmost layer claiming the point; an edit it commits is one undo step. `CurveEditor`'s right-click delete goes through it, so it can be undone on its own, and `Plot2D` takes an `onContextMenu` that is handed plot and model coordinates. `CurveEditor` no longer wraps its plot in a `div`.
