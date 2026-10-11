---
'@weasel-js/labkit': patch
---

`ControlMatrix` now honors `showIf` and `enableIf`, as data or as a function, on a cell's leaf and on every group above it, through the same `isLeafVisible` and `isLeafEnabled` a `ControlPanel` asks. A cell whose `showIf` fails is drawn empty, and a setting no column shows has no row. A cell whose `enableIf` fails is dimmed and takes no input: its switch does not flip, its popover does not open, and Option-click does not unpin it. A leaf's static `hidden` flag still does not drop a row, since `rows` names it.
