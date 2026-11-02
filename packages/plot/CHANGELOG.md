# @weasel-js/plot

## 1.15.2

### Patch Changes

- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/theme@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/text@1.15.2

## 1.15.1

### Patch Changes

- 999fba9: Every plot kind can be authored from nothing, not only adjusted. Each kind has pure edits that insert, remove, and reorder every collection its spec holds (`insertPieSlice`, `insertXyRow`, `insertXySeries`, `removeGanttTask`, `insertTimelineEvent`, `insertQuadrantClass`, `insertGitCommand`, `insertSankeyLink`, `insertPacketField`, `moveRadarAxis`, …) and set the fields no drag reaches: titles, axes and their ends, chart options, a task's id, tags, start and end, a commit's every field. `moveGanttTaskToSection` moves a gantt task into another section, keeping its id and the dependencies on it. A removed or renamed gantt task id leaves every `after` and `until` that named it; a removed or renamed quadrant class leaves every point that used it.
  
  `plotSchemaOf(data)` describes a spec of any kind as fields and tables of rows, a table holding tables of its own under each row (a gantt's sections hold their tasks), each read and write going through those edits, so a host builds a form or a grid knowing no kind. `plotRootContaining(scene, id)` names the plot a node is the root or a mark of. `setXyValue` now pads a series shorter than the chart's rows instead of throwing.
  
  `@weasel-js/ui` adds `PlotDataPanel`, which renders that schema for one chart: a row per field, a grid per table with add (at the end, or after any row), remove and drag-to-reorder, rows opening onto the tables they hold.
  
  `@weasel-js/plot` now exports `formatGanttStart`, `parseGanttStart`, `formatGanttEnd` and `parseGanttEnd`, which the Mermaid gantt reader and writer use.
- 69f0788: `PlotData` holds nine more chart kinds besides `xychart`: `gantt` (tasks on a time scale, starts and ends kept as
  written so a task after another moves with it), `timeline`, `pie`, `quadrant`, `journey`, `gitgraph`, `sankey`,
  `packet` (a band scale of bits) and `radar` (on the new `polarScale`). Each compiles to marks through
  `plotSpecs` and is edited as its spec: dragging a task's span or its end, a quadrant or radar point, or a journey
  score; reordering a timeline's periods; and editing text in place, which `foldPlotText` and `usePlotTextEdit` fold
  into one edit of the spec. `PlotView` turns text editing on. A `PlotEditor`'s `handle` may now return several handles,
  each with a `part` and optionally a `box` that takes a press anywhere inside it, and editors may define `text`. This
  adds API.
- 8c13aee: `@weasel-js/plot` now holds the one implementation of scales and ticks, and ui uses it.
  
  `@weasel-js/plot/scales` is a new subpath with every scale and tick helper and no React, DOM or scene. A linear
  scale gains `spacedTicks({ minSpacing, inset })`, which picks ticks by the room between them along the range and
  returns them with their step and shared decimals; `niceStep`, `decimalsOf`, `tickDecimals`, `formatTick`,
  `TickSet`, `TickFormatCtx`, `TickFormatter` and `ContinuousScaleFactory` are exported beside it.
  
  This breaks ui's API. Removed from `@weasel-js/ui`, with what replaces each:
  
  - `niceTicks`, `niceStep`, `stepDecimals`, `tickDecimals`, `formatTick` and their types: import from
    `@weasel-js/plot/scales`; `niceTicks(range, px, opts)` is `linearScale({ domain: range, range: [0, px] })
    .spacedTicks(opts)`, and `stepDecimals` is `decimalsOf`.
  - `linearScale`, `logScale`, `SliderScale` (from `Slider`) and `BandScale` (from `BandEditor`): `Slider`'s and
    `BandEditor`'s `scale` prop now takes a scale factory such as plot's `logScale`, which the control calls with
    `{ domain: [min, max], range: [0, 1] }`. A hand-written `{ toUnit, fromUnit }` no longer fits; build a
    `ContinuousScale` instead. A `Slider` given `logScale` with a `min` of zero or below now throws rather than
    placing its thumbs at `NaN`.
- 728db32: Add `@weasel-js/plot`, charts on the scene graph. Scales (`linear`, `log`, `band`, `time`, `ordinal`), axes, and
  marks (`bar`, `span`, `line`, `area`, `point`, `arc`, `ribbon`, `rule`, `text`) that keep their datum in scene data;
  `PlotData`, a union of chart specs that `plotSpecs` compiles to one root node holding the spec with its marks under
  it; `replacePlotData`, which swaps a spec as one undo entry; and `plotEditing` and `PlotView`, which edit a chart by
  dragging its marks. `xychart` is the first kind: bar and line series over categories or a numeric range.
- Updated dependencies [d2110bc]
- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [8ad43af]
- Updated dependencies [937167e]
- Updated dependencies [120420a]
- Updated dependencies [e982d8a]
- Updated dependencies [156bcd0]
  - @weasel-js/text@1.15.1
  - @weasel-js/core@1.15.1
  - @weasel-js/geom@1.15.1
  - @weasel-js/theme@1.15.1
