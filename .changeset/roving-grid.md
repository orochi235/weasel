---
'@weasel-js/ui': patch
---

`useRovingTabIndex` takes `columns`, which lays its items out as a grid: Left and Right step through them in reading order, wrapping at the ends, and Up and Down move a row, keeping the column. Down into a row too short to have that column lands on the row's last item, and Up and Down stop at the first and last rows. `groupSelector` starts each matching element's items on a row of their own. The pure `rovingGridTarget` and `rovingTarget` are exported beside it.

`ToolPalette` with `columns` uses it, so Up and Down in a palette laid out as a grid move a row of the group rather than one button.
