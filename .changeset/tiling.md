---
'@weasel-js/ui-logic': patch
'@weasel-js/ui': patch
---

Add `tileGrid` to `@weasel-js/ui-logic`: a run of same-size items laid out as a grid `columns` across, with a short last row at its start, centered, at its end, or stretched across the row (`lastRow: 'fill'`), giving its tracks, each item's span, and which of the grid's outer corners each item sits on. `@weasel-js/ui`'s `tiling` draws it as a CSS grid: the container's class and style and each item's attributes, among them `data-tile-corners`; `tilingRoving` gives the matching `useRovingTabIndex` options. `SwatchGrid` and `ToolGroup` now lay out through it.

`ToggleBar`, `ButtonBar` and `OptionsBar` take `columns` and `lastRow`, wrapping their segments into a grid in one well rounded at its outer corners. A sweep runs across the rows.

`rovingGridTarget` moves from `@weasel-js/ui` to `@weasel-js/ui-logic`, beside `rowOffset` and `gridLayout`, and takes a layout (`{ dir, offsets, widths }`) in place of its `dir` argument: Up and Down move to the item drawn under the focused one in a row that sits off the start or is stretched, the later of two half-covering it going down and the earlier going up. `useRovingTabIndex` takes `lastRow`. A Down or Up with no item beneath now lands on that row's nearest item in `SwatchGrid` too, as it already did in every other roving grid, where before it stayed put.
