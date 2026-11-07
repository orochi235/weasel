# @weasel-js/plot

## 1.17.2

### Patch Changes

- 86783f4: `bandScale(...).invert` on a zero-width range answers the first key, where every band sits. It used to answer `undefined`, which its docs promise only for an empty domain.
- d2800fb: A `logScale` with a base other than 10 labels its powers below 1 with the digits they need. A base-2 scale's 0.125 and 0.25 used to read `0.1` and `0.3`.
- 2c9b792: `logScale` throws on a `base` that is 1, not above zero, or not finite, as `powScale` throws on an exponent of zero. It used to build a scale that mapped every value to `NaN` and ticked none.
- 90600b4: `formatNumber`, `formatTick` and every scale label built on them write a value of 1e21 or more in full digits, as they write a smaller one. Such values used to switch to `1e+21`, so a log axis from 1e20 to 1e22 read `100000000000000000000`, `1e+21`, `1e+22`.
- 436c47d: `powScale` throws on a negative exponent over a domain that reaches zero, as `logScale` throws on a domain not above zero. It used to build a scale that mapped and inverted every value to `NaN`.
- e0a37af: A `timeScale` whose domain reaches past the instants a `Date` can hold (about ±275,000 years from 1970) ticks only the part it can hold. Its `ticks()` used to loop forever.
- Updated dependencies [d15e917]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [dd926dc]
- Updated dependencies [cda0a20]
- Updated dependencies [c089c61]
- Updated dependencies [cc591ff]
- Updated dependencies [e6e7a72]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [35c291a]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [e13e539]
- Updated dependencies [fce3d09]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [d3654a1]
- Updated dependencies [3c8c5af]
- Updated dependencies [cd0738d]
- Updated dependencies [8c4bf4d]
- Updated dependencies [c7dae1d]
- Updated dependencies [c2a7267]
- Updated dependencies [26187c9]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
  - @weasel-js/core@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/text@1.17.2
  - @weasel-js/theme@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/text@1.17.1
  - @weasel-js/theme@1.17.1

## 1.17.0

### Patch Changes

- 3a4cc62: A number pref's slider can space its track other than linearly. A number leaf takes `scale`: `'linear'`, `'log'`, `'sqrt'`, or a `{ to, from }` pair, and labkit's `NumberNode` takes `.scale(...)`, so a segment count where 1–100 matters most, `f.number(16).range(1, 1000).step(1).scale('log')`, gives 1–10, 10–100 and 100–1000 a third of the track each. Only the track changes: the typed value, `step`, `stops`, the arrow keys and the stored value stay in the value's own units. Under a `unit` the scale spaces the shown values. A `'log'` track over a range not above zero warns once in development and is drawn linear. `PropertyField`'s number field takes `scale` as a `ContinuousScaleFactory`, as `Slider` does, and draws its stops where the scale puts them; ui's `prefNumberScale` turns a leaf's `scale`, or a factory, into one, naming its caller in the log warning when given a label. `BandEditor` resolves its `scale` through it too, so its log default now also falls back to linear, rather than throwing, while an edge drag stretches the axis down to zero or below. `PrefSchemaEditor` offers linear, log and sqrt for a number leaf. Additive.
  
  `@weasel-js/plot/scales` adds `powScale({ domain, range, exponent })`, which keeps a negative value's sign so a square-root scale (`exponent: 0.5`) takes zero and negatives, and `warpScale({ domain, range, to, from })`, a scale linear in `to(value)`. Both tick and label in value units, as `linearScale` does. `Scale.kind` and `ContinuousScale.kind` gain `'pow'` and `'warp'`.
- 1d6fe9b: An axis asked for more ticks than the default labeled them at the default's precision: `axisMarks({ ticks: 20 })` on a 0..1 linear scale read `0, 0.1, 0.1, 0.2…` instead of `0, 0.05, 0.1, 0.15…`, and a time axis with hourly ticks labeled each one with its date. Every built-in scale now has `tickFormat(count)`, which returns a formatter at the precision of `ticks(count)`, and `axisMarks` and `axisRoom` label through it. `format(value)` is unchanged. A scale of your own without `tickFormat` is labeled with `format`, as before, and so is a built-in scale whose `format` was replaced (`{ ...scale, format }`), as gantt's `axisFormat` does.
- a4b3961: `ticks()` on a linear, log, or time scale whose domain reached `Infinity`, or a linear scale spanning more than `Number.MAX_VALUE` (say `-1e308..1e308`), never returned. They now return no ticks for an infinite domain and a few for a vast finite one. A time scale reaching back before the year 100 also placed its first ticks in the 1900s, out of order, because `Date.UTC` reads years 0 to 99 as 1900 to 1999.
- d29469c: A linear scale over a domain finer than about 1e-20 put every tick at 0 and labeled each one `0`, and a log scale labeled its ticks below 1e-20 `0`: tick values and labels were rounded to at most 20 decimals. They now round to as many as `toFixed` allows, 100.
- Updated dependencies [d28ff77]
- Updated dependencies [217246e]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [436da9e]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [6539d70]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [d5cc782]
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [e989ef7]
- Updated dependencies [e6cf896]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [e603f3f]
- Updated dependencies [34da47e]
- Updated dependencies [5491ac0]
- Updated dependencies [fed446b]
- Updated dependencies [ad2f2a3]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/core@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/theme@1.17.0
  - @weasel-js/text@1.17.0

## 1.16.2

### Patch Changes

- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
  - @weasel-js/core@1.16.2
  - @weasel-js/geom@1.16.2
  - @weasel-js/text@1.16.2
  - @weasel-js/theme@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [3afef45]
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [5a2e82a]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
  - @weasel-js/geom@1.16.1
  - @weasel-js/core@1.16.1
  - @weasel-js/text@1.16.1
  - @weasel-js/theme@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [22451fd]
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/theme@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/text@1.16.0

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
