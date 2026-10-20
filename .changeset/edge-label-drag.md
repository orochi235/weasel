---
"@weasel-js/geom": patch
"@weasel-js/diagram": patch
---

An edge label can be dragged along and beside its edge. `diagramLabelDrag({ scene, selected })`
returns a layer and a contribution: a drag on a label (`diagram.moveLabel`) stores where it was
dropped as a fraction along the route (`at`), an offset from the line (`offset`), and
`dodge: false`, so label placement leaves it there and it keeps its spot when the edge reroutes. A
click on a label selects its edge, and a double-click edits its text. Locked and hidden labels do
not drag. With no `commit` the drag writes the scene in one undoable entry; `DiagramView` reports it
through `onMoveLabel` instead. `diagram.resetLabel` (`RESET_LABEL_ACTION_ID`) puts the selected
edges' dragged labels back to `LABEL_PLACEMENT`, which the main entry now exports.

Geom adds `PathMeasure.nearest`, the arc length along a path nearest a point.

All of it is additive. weaselchart adds label dragging and Format › Connector › Reset label.
