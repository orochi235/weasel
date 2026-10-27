---
'@weasel-js/guides': patch
---

The drawn grid follows a container's unit scope. `createGridLayer` and `useGridCellHover` take
`scopes` and `regions`, and inside each container declaring a scope the grid draws and hit-tests
that scope's lattice, cut out of the one around it. `sceneGridRegions` builds the regions from a
scene, a hovered cell carries its lattice's `pitch` for `createCellHighlightLayer`, and
`gridPitch` is the one place every grid reader takes its pitch from.
