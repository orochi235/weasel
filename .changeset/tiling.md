---
'@weasel-js/ui': patch
---

Add `tiling`: one spec for a run of same-size controls laid out as a grid `columns` across, with a short last row at its start, centered, at its end, or stretched across the row (`lastRow: 'fill'`). It gives the container's class and style and each item's attributes, among them `data-tile-corners`, the grid's outer corners the item sits on; `tilingRoving` gives the matching `useRovingTabIndex` options. `SwatchGrid` and `ToolGroup` now lay out through it.

`ToggleBar`, `ButtonBar` and `OptionsBar` take `columns` and `lastRow`, wrapping their segments into a grid in one well rounded at its outer corners. A `ToggleBar` sweep runs across the rows.

`useRovingTabIndex` takes `lastRow`, and `rovingGridTarget` takes a layout (`{ dir, offsets }`) in place of its `dir` argument: Up and Down move to the item drawn under the focused one in a row that sits off the start, the later of two half-covering it going down and the earlier going up. A Down or Up with no item beneath now lands on that row's nearest item in `SwatchGrid` too, as it already did in every other roving grid, where before it stayed put.
