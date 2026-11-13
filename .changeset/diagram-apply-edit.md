---
'@weasel-js/diagram': minor
---

`applyDiagramEdit` and `applyNodeResizes` store what a `DiagramView` reports back into its `DiagramData`.

`applyDiagramEdit(data, edit)` writes an `onEdit` report the way `onMove` and `onEditContainer` say to store one: each moved node's `at`, pinned, its new region, each rerouted edge's `routed` and `routedPorts`, a region's `box`, a pool's lanes, a released container's members. `{ pin: false }` leaves what moved unpinned, for data built with `layout: 'none'`.

<!-- entry: rank=5 api new -->
