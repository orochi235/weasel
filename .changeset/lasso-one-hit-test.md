---
"@weasel-js/core": patch
---

`useLassoTool({ behaviors })` now runs the behaviors it is given. They used to be dropped before they reached the lasso action. Each behavior's `onStart`, `onMove` and `onEnd` run as the gesture does. The first `onEnd` that returns ops has them applied in place of the default selection, and one that returns `null` leaves the selection alone. `selectFromLasso({ mode })` hit-tests through the canvas's own lasso, in its own mode.

`sceneToAdapter(...).hitTestLasso` gives the same answer as the lasso tool: shapes are tested by their drawn outline with rotation applied, not by their bounding box. An ancestor's clip now has to overlap the lasso itself, not just the shape. It still returns containers, as its `hitTestArea` does. `arrayAdapter.hitTestLasso` still tests bounding boxes.

Lasso `intersect` mode and the marquee now test curves by the drawn curve, not by their control points, so a lasso next to an ellipse no longer takes it. They also treat a path that is left open as a line with no fill.
