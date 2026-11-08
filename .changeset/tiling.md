---
'@weasel-js/ui': patch
---

Add `tiling`: one spec for a run of same-size controls laid out as a grid `columns` across, with a short last row at its start, centered or at its end. It gives the container's class and style and names the item that starts an offset last row; `tilingRoving` gives the matching `useRovingTabIndex` options. `SwatchGrid` and `ToolGroup` now lay out through it.

`useRovingTabIndex` takes `lastRow`, and `rovingGridTarget` takes a layout (`{ dir, offsets }`) in place of its `dir` argument: Up and Down move to the item drawn under the focused one in a row that sits off the start, the later of two half-covering it going down and the earlier going up. A Down or Up with no item beneath now lands on that row's nearest item in `SwatchGrid` too, as it already did in every other roving grid, where before it stayed put.
