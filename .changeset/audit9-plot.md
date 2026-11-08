---
'@weasel-js/plot': patch
---

Fix xychart category bands, bar and radar drag handles, timeline period moves, and PlotView's prop handling.

- An xychart with fewer categories than values now draws the extra rows, numbered as the data table shows them, and a category label written twice gets two bands instead of stacking both rows' bars on one.
- An xychart bar's drag handle sits on its value end when the bar runs down from the baseline: a value below a value axis that starts above zero, or any bar on a reversed axis.
- `moveTimelinePeriod` keeps sections that had no periods before the move; it used to drop them.
- A radar with no `max` can have a point dragged past the rim, so its largest value can grow. Before, the drag stopped at the rim. `polarScale`'s `valueAt` and `radarValueAt` take a new optional `open` argument that reads past the rim.
- `PlotView` no longer calls `onChange` when the chart is redrawn from a new `data` prop, redraws when the `measure` prop changes, and goes back to the default theme when the `theme` prop is removed.
