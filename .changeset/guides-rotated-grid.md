---
'@weasel-js/guides': patch
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

A scoped container's grid runs in the container's own frame: from its corner, along its axes, so
it turns when the container does. `sceneGridRegions` gives each region its `frame` and, without an
`outlineOf`, the outline the container draws; the grid layer draws a region's lattice in that
frame, and `pointToGridCell`, `useGridCellHover` and `createCellHighlightLayer` count and draw a
cell in it. `gridSnapSource` rounds in the same frame, read through the new
`SnapCollect.frameOf`, which a scene session fills from `sceneBoxFrames`. This changes behavior
for an unturned container too: its lattice now starts at its corner rather than at the grid's
origin. A subject spread over two containers still snaps on the world lattice.
`sceneGridRegions` now takes a `Scene`, and `GridRegionScene` is gone. geom adds `boxFrameOf` and
`pxExtentInFrame`.
