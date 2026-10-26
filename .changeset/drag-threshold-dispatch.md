---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

An ongoing action, or one binding of it, can declare `dragThresholdPx`: the dispatcher holds a pointer drag until it has traveled that far, then calls `start` with the press's context, and a release short of it never starts the action. `insert` declares 8px (`INSERT_DRAG_THRESHOLD_PX`), so a click that wobbles a few pixels with a shape or stencil tool no longer draws a shape a few pixels wide. `move`'s `dragThresholdPx` option now rides the move bindings' `dragThresholdPx` instead of a `params` entry the action read itself, so a move action invoked directly no longer holds a short drag.
