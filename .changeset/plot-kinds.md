---
'@weasel-js/plot': patch
---

`PlotData` holds nine more chart kinds besides `xychart`: `gantt` (tasks on a time scale, starts and ends kept as
written so a task after another moves with it), `timeline`, `pie`, `quadrant`, `journey`, `gitgraph`, `sankey`,
`packet` (a band scale of bits) and `radar` (on the new `polarScale`). Each compiles to marks through
`plotSpecs` and is edited as its spec: dragging a task's span or its end, a quadrant or radar point, or a journey
score; reordering a timeline's periods; and editing text in place, which `foldPlotText` and `usePlotTextEdit` fold
into one edit of the spec. `PlotView` turns text editing on. A `PlotEditor`'s `handle` may now return several handles,
each with a `part` and optionally a `box` that takes a press anywhere inside it, and editors may define `text`. This
adds API.
