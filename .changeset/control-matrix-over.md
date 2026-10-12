---
'@weasel-js/labkit': patch
---

`ControlMatrix` takes `over`, the schema its aliases point into and its conditions may read, as `ControlPanel` does. This adds a prop. A cell's `showIf` and `enableIf` read a setting of `over` at its default where the config holds nothing, and the popover an alias's cell opens edits the leaf of `over` at the alias's path. The cell's own summary still reads the alias's path.
