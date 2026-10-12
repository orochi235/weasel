---
'@weasel-js/quantity': patch
'@weasel-js/guides': patch
'@weasel-js/core': patch
---

Adds API: a plane's axes can carry different units. `resolveAxes(value, units)` in `@weasel-js/quantity` resolves one value for both axes, or `{ x, y }`, against one `UnitSystem` or one per axis (`PlaneUnits`), and `formatAxes` writes a base-unit point back out with each axis in its own display unit. `axisUnits`, `PerAxis`, `PlaneUnits`, and `PlaneValue` are exported beside them, and all are re-exported from `@weasel-js/core`.

`gridSnapStrategy`, `pointToGridCell`, `createGridLayer`, `createCellHighlightLayer`, and `useGridCellHover` take a per-axis `spacing` and `unitSystem`, so a grid can be 1s wide and 5mV tall. A single value still means a square grid.
