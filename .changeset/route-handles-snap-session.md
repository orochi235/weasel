---
"@weasel-js/diagram": patch
---

Route-handle drags now snap through the canvas's `snap` dep instead of a private snapper: a dragged bend or segment still lines up with the stops beside it and with a port's axis within `snapPx`, and now also with the canvas's other sources, such as a grid. Ctrl suspends snapping, Shift holds a dragged bend to the axes and diagonals, and the alignment marks are drawn by the canvas's snap readout rather than as the action's own guide overlay. The edited edge offers no targets, and the canvas's default anchor snapping (`'path-snap'`) is left out for these drags. `snapPoint`, `portTarget` and `stopTarget`, and their types `SnapTarget` and `Snapped`, are removed.
