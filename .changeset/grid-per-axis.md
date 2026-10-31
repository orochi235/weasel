---
'@weasel-js/guides': patch
---

A grid's `spacing` can now give each axis its own rule: a pitch, a pitch with an `offset` limited to
`from`..`to`, or lines at explicit positions (`{ at: [...] }`) for uneven bays. An axis left out has no
lines, so it neither draws nor snaps. The layer, the snap source, the preset, `pointToGridCell` and
`useGridCellHover` all read the new shape.

A container can run a grid of its own through `gridOf` on `gridSnapSource` (or the preset's `snap`) and
`sceneGridRegions`, which its children snap to in its frame, scale included; `null` gives a container
no grid. The grid source lands a node's snap anchors instead of its box, and `gridFit` reports whether
a set of points sits on a grid's crossings. `gridSnapSource` takes an `id`, so two grids can snap on
one canvas.

Breaking: `sceneGridRegions` takes `{ root, gridOf }` in place of the root scope. A `GridCell` carries
its `box` in place of `pitch`, and `pointToGridCell` returns `null` off the lines.
`createCellHighlightLayer` draws the cell's `box`, so it no longer takes `spacing`, `unitSystem` or
`origin`. `gridPitch` and `scopedGridPitch` are replaced by `gridLines`, which resolves every axis's
lines.
