---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

`reconcileSpecs(scene, prev, next)` brings a scene from one list of node specs to another: it adds and removes by id and writes only the fields that changed between the two lists, as one untracked step. What the scene did since `prev` survives unless `next` changes that same field.

`DiagramView` no longer remounts on a new `specs` array. It reconciles the new specs into the scene it holds, so the view, the pick and anything moved stay put. `onMove` turns on dragging and reports every node a drag or a layout run moved. `onConnect` makes ports grabbable and reports the edge a connect describes without drawing it, and `canConnect` and `portOptions` configure that. A `ref` gets `layout(algorithm)`, which re-runs a layout animated from where the nodes stand, and the run's `live` controls; `live` configures the run.

`diagramScene` gives every spec an id, and takes `layout: 'none'` to leave each node at its `at`.

`fitDiagram`'s scale and anchor arguments are now one options object.
