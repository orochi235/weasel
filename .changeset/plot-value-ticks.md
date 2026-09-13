---
'@weasel-js/ui': patch
---

`Plot2D` draws ticks. `xTicks` and `yTicks` take a line at each tick and a label
naming it, placed inside the plot or hanging past its edge. Left to themselves the
ticks land on round 1, 2 or 5 steps, as many as `minSpacing` allows at the plot's
current size; `values` gives them explicitly. Every label in a column shares its
decimal places, and `format` replaces the text. `LayeredCurveEditor`,
`CurveEditor` and `PointPlotter` pass both props through. `niceTicks`, `niceStep`
and `formatTick` are exported for anything drawing its own axis.

A timeline lane in graph mode now labels its value axis in the gutter beside the
track, and its time grid is drawn through the same ticks.
