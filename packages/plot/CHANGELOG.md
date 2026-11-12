# @weasel-js/plot

## 1.19.0

### Patch Changes

- 65ee9a0: Layouts, bounds, legends and reports over hundreds of thousands of items no longer overflow the call stack. This covers, for example, a grid of a million nodes, a million pages, a polyline of a million points and a store of a million prefs records.
  
  <!-- entry: fix -->
- ca94f2d: `bandScale` takes its default padding for a `paddingInner` of `NaN` or a `paddingOuter` that is not finite.
  
  <!-- entry: rank=-5 fix -->
- 8ac5c6f: Charts draw only finite geometry from any data.
  
  A quadrant point is held to the unit square, and one with a `NaN` coordinate is not drawn; a negative or non-finite radius or stroke width takes the default, and a radius past the plot is cut to it. A radar value short of the center's is drawn at the center, and a journey step with a `NaN` score draws no face. A packet field's fractional bit is read as the bit it falls in. Sankey flows whose sum is past the double range keep their proportions.
  
  <!-- entry: fix visual -->
- 5f0d749: An xychart's and a radar's data are cut to the plot area, so nothing past it is drawn on the canvas or in any export.
  
  A bar past a fixed end of the value axis is cut at the plot's edge, with its drag handle on that cut end. A line is clipped to the plot, a radar's outline and fill to its rim, and a point whose center falls outside is not drawn.
  
  <!-- entry: fix visual -->
- e6d57fe: The plot clipper holds a rect of zero width or height, or a circle of zero radius, to the segment or point it is.
  
  <!-- entry: rank=-5 fix -->
- e0a3d33: The plot clipper pulls a point that lands a rounding outside the area inside it.
  
  <!-- entry: rank=-5 fix -->
- 7a29e1b: `clipPolygon` no longer answers `NaN` corners where a polygon edge crosses a side of the area only far out.
  
  <!-- entry: rank=-5 fix -->
- 5ea8837: `formatNumber` and a linear, log, pow or warp scale's `format` write a small negative that rounds to zero as `0`, not `-0`.
  
  <!-- entry: fix -->
- a97da18: `formatTick` writes a value or step finer than 1e-100 with an exponent, as `formatNumber` does, so subnormal ticks no longer all read `0`.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: `formatGanttEnd` writes a duration's amount in digits (`0.0000001d`), never with an exponent, so `parseGanttEnd` reads it back as a duration.
  
  <!-- entry: fix data -->
- c75559c: A gantt task whose end is past what a `Date` or a number holds is drawn instead of producing `NaN`.
  
  A duration of months past the year 275760 ends 30 days a month on, and one past the double range ends at its edge. `parseGanttDate` refuses `x` and `X` digits past the double range. A chart whose tasks all sit too far out for a day to move them spans more than one instant.
  
  <!-- entry: rank=-5 fix -->
- dcbcc5d: Editing or removing a gantt task whose id another task also holds keeps the `after` and `until` dependencies on that id.
  
  <!-- entry: fix -->
- e5cbd2e: A git graph commit given no id takes the first `#n` that no commit holds, so the replay no longer stops with `a commit "#2" already exists`.
  
  <!-- entry: fix -->
- a6fb3c0: A git graph places a branch whose `order` is `NaN` as one with no order, by where it was created.
  
  <!-- entry: rank=-5 fix -->
- a6ffc20: `logScale` places a value between ends whose logarithms round together by its distance from the start, the same both ways round.
  
  <!-- entry: rank=-5 fix -->
- 3137efc: `logScale` keeps about twice the tick count across many decades, every few decades, instead of one tick a decade.
  
  <!-- entry: behavior visual -->
- b1309b2: A `logScale` whose ends are too near for their logarithms to differ maps them to the range's ends and gets no tick from outside it. Its `invert` at the range's ends stays finite.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: A `logScale` of a base other than 10 labels small ticks to their own digits, so 1.09e-12 and 1.2e-12 no longer both read `0.000000000001`.
  
  <!-- entry: fix visual -->
- f77795f: An xychart or radar whose values run to millions no longer overflows the call stack while fitting its value range.
  
  <!-- entry: fix -->
- 9723ed2: `niceDomain`, and a `linearScale` with `nice`, keep a domain near `Number.MAX_VALUE` finite. A span too fine for its step, such as `[0, 5e-324]`, is kept as given.
  
  <!-- entry: rank=-5 fix -->
- cc185ab: `niceStep` keeps a rough step whose rounding up would pass the largest double, so `spacedTicks` over the whole double range gives finite ticks.
  
  <!-- entry: rank=-5 fix -->
- d69b413: A pie whose slice values add up past what a number holds draws and labels each slice at its share.
  
  <!-- entry: rank=-5 fix -->
- 6ead2a8: A quadrant chart finds a point's class among its own `classes` only, never an inherited key such as `constructor` or `__proto__`.
  
  <!-- entry: rank=-5 fix -->
- 46dfb3e: `ordinalScale` and `bandScale` list a key their domain names twice once, at its first place.
  
  <!-- entry: fix -->
- b1309b2: Scale ticks finer than 1e-100 apart keep their values and are labeled with an exponent (`1e-300`) instead of all reading `0`.
  
  A span among the subnormals is ticked at multiples of itself, with no tick outside it.
  
  <!-- entry: rank=-5 fix -->
- 3137efc: Linear, power, warp and time scales place a value when the domain's span, or the value's distance from its start, is past the double range.
  
  `linearScale({ domain: [-Number.MAX_VALUE, Number.MAX_VALUE] }).map(0)` is the range's middle, and `invert` sends the range's ends to the domain's exactly. An xychart over values near `±Number.MAX_VALUE` draws its bars.
  
  <!-- entry: rank=-5 fix -->
- dcd3f2c: `spacedTicks` returns no ticks where `minSpacing` spans more of the domain than the largest double, instead of ticks at `NaN`.
  
  <!-- entry: rank=-5 fix -->
- cfd1fc7: `spacedTicks` gives no tick past the domain when its step is far wider than the domain.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: `tickStep` no longer rounds a span near the largest double up to `Infinity`, so such a scale's ticks are finite.
  
  <!-- entry: rank=-5 fix -->
- 3137efc: A time axis labels a month of a year past 9999 whole, as in `10000-02`.
  
  <!-- entry: rank=-5 fix -->
- dcf2a76: `formatTick` and `toFixedPlain` hold `decimals` to the 0 to 100 places `toFixed` takes, rather than throwing a `RangeError`.
  
  <!-- entry: rank=-5 fix -->
- 36504c7: An xychart in a box too short for its axes keeps its axes, bars and points inside the plot instead of drawing them above the chart.
  
  <!-- entry: fix visual -->
- Updated dependencies [0896b71]
- Updated dependencies [aaeec8d]
- Updated dependencies [bbfb059]
- Updated dependencies [65ee9a0]
- Updated dependencies [2595ad3]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [6ff27f5]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
- Updated dependencies [2cc9303]
- Updated dependencies [b1309b2]
- Updated dependencies [ca65cf7]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [056d901]
- Updated dependencies [42e088a]
- Updated dependencies [214a57e]
- Updated dependencies [8a41dc2]
- Updated dependencies [433a5ad]
- Updated dependencies [b1309b2]
- Updated dependencies [01e5634]
- Updated dependencies [4ecaf12]
- Updated dependencies [3ed07dc]
- Updated dependencies [25b09cf]
- Updated dependencies [867f10c]
- Updated dependencies [d5a83f9]
- Updated dependencies [799636f]
- Updated dependencies [c09afdf]
- Updated dependencies [e36ca03]
- Updated dependencies [3feac74]
- Updated dependencies [b8ea958]
- Updated dependencies [b8ea958]
- Updated dependencies [a98d4ee]
- Updated dependencies [a74983a]
- Updated dependencies [a547bff]
- Updated dependencies [a43fd34]
- Updated dependencies [d83feb6]
- Updated dependencies [14398f2]
- Updated dependencies [39c0d34]
- Updated dependencies [63edf95]
- Updated dependencies [7620d78]
- Updated dependencies [5f06b1f]
- Updated dependencies [b8ea958]
- Updated dependencies [1fc9a81]
- Updated dependencies [e913291]
- Updated dependencies [44999ca]
- Updated dependencies [faaeb54]
- Updated dependencies [0e8df4d]
- Updated dependencies [adc2756]
- Updated dependencies [4be628a]
- Updated dependencies [7a7c2ef]
- Updated dependencies [fef31b7]
- Updated dependencies [2bde466]
- Updated dependencies [f718790]
- Updated dependencies [f137f48]
- Updated dependencies [f0c159d]
- Updated dependencies [caffe33]
- Updated dependencies [18122f9]
- Updated dependencies [4bbda04]
- Updated dependencies [886642a]
- Updated dependencies [b1309b2]
- Updated dependencies [7b9e651]
- Updated dependencies [efac12a]
- Updated dependencies [ebab03f]
- Updated dependencies [92adc08]
- Updated dependencies [0a82772]
- Updated dependencies [eaff448]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [3bedaa8]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
- Updated dependencies [c3dc307]
- Updated dependencies [2a9727c]
- Updated dependencies [521bc15]
- Updated dependencies [997e4f3]
- Updated dependencies [12f254e]
- Updated dependencies [0866208]
- Updated dependencies [96bbb4a]
- Updated dependencies [4224853]
- Updated dependencies [4e6aad8]
- Updated dependencies [01b996e]
- Updated dependencies [33633eb]
- Updated dependencies [8e8a341]
- Updated dependencies [ac2ab9d]
- Updated dependencies [c089fd1]
- Updated dependencies [b7f10eb]
- Updated dependencies [355a332]
- Updated dependencies [ada22ef]
- Updated dependencies [1379dff]
- Updated dependencies [b4f5abf]
- Updated dependencies [3c2cddd]
- Updated dependencies [263aa62]
- Updated dependencies [9f52075]
- Updated dependencies [aa35a8f]
- Updated dependencies [2c54d23]
- Updated dependencies [1167180]
- Updated dependencies [1b24a9a]
- Updated dependencies [db86b0c]
- Updated dependencies [fa2b6a2]
- Updated dependencies [37e0907]
- Updated dependencies [f7e4000]
- Updated dependencies [9334505]
- Updated dependencies [fcd1616]
- Updated dependencies [54b81ce]
- Updated dependencies [3643214]
- Updated dependencies [b8ea958]
- Updated dependencies [b1309b2]
- Updated dependencies [b80eae4]
- Updated dependencies [b1309b2]
- Updated dependencies [73fd11f]
- Updated dependencies [038a0da]
- Updated dependencies [6999cce]
- Updated dependencies [4d16c8a]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/geom@1.19.0
  - @weasel-js/text@1.19.0
  - @weasel-js/theme@1.19.0

## 1.18.2

### Patch Changes

- ea6c53b: Fixes to tiled layer stacking, ruler ticks zoomed far out, the obstacle-avoiding router's spatial index, and sizes in plot and snapPoint that hung on huge values.
  
  - A tiled layer draws a `space: 'screen'` source in its place among its sources. Before, every screen-space source was drawn under all the tiled ones, so a HUD listed last sat under the backdrop.
  - `rulerTicks` lays out no ticks once labeled ones would sit under a pixel apart. Zoomed out past the longest step a unit system has (a `PIXELS` document near the zoom floor), it made hundreds of thousands to millions of ticks per ruler, every frame.
  - The obstacle-avoiding router no longer hangs on a connector whose waypoint is infinite, and no longer walks millions of cells for one a billion units away: its spatial hash checks an item or a query spanning thousands of cells by its box instead of filing or visiting each cell.
  - Packet charts hold bits per row to 1–128 and draw fields up to bit 4095 (512 bytes); radar charts draw 1–20 rings. The editors' inputs carry these maxima and clamp a larger value typed in, and a spec loaded from text is held to them when drawn. A huge value used to hang the chart: `bitsPerRow: 1e9` built a billion-key scale, a field to bit `1e12` cut billions of row pieces, and `ticks: 1e9` drew a billion rings. A NaN bits per row or ring count now falls back to the default (32, 5).
  - `snapPoint({ pattern: 'grid' })` offers at most 129 × 129 points, those around the dragged child's pose, where a spacing tiny next to the container listed billions of drop targets.
- 3d522ea: Fixes for hangs and crashes far from the origin, at a zero gap, and on Mermaid ids given twice.
  
  - A gantt task counted in days or weeks from a start past what a `Date` holds (a huge `x` or `X` date) is no longer walked day by day, which never ended.
  - `rulerTicks` lays out no ticks once the view is panned so far that ticks a step apart are one number, where the tick loop never ended.
  - `linesIn` lists no lines of a pitch that far out, where it grew an array until it threw, so a grid layer drawn there draws none.
  - `snapPoint`'s grid pattern counts its points from 0, so a dragged pose too far out for grid indices to count offers points instead of hanging.
  - A tiled parallax layer panned that far draws no copies, where its copy loop never ended.
  - The avoid router checks an item or query so far out that its cell indices stop counting by its box, where the spatial hash's cell walk never ended.
  - The avoid router files an obstacle in its visibility graph only over the search window and its points, in at most 4096 strips. An obstacle running to infinity, or spanning a vast window, ran out of memory, and a box with a NaN side left every other obstacle out of the graph.
  - `layered` with a `nodeGap` of 0 places nodes joined by a long edge at finite positions; every node landed at NaN.
  - A Mermaid architecture diagram naming a service, junction or group twice is refused, naming the line, as Mermaid refuses it. Before, it read into a page that could not be drawn or written.
  - A Mermaid mind map node repeating another's id reads with a unique one (`a_2`), as Mermaid draws both. Before, the page could not be drawn or written.
- Updated dependencies [7fff1b9]
- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [6a72bc3]
- Updated dependencies [0c77d00]
- Updated dependencies [fc38c90]
- Updated dependencies [389a7f9]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [707636a]
- Updated dependencies [30dd2dc]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [8d97dd3]
  - @weasel-js/theme@1.18.2
  - @weasel-js/core@1.18.2
  - @weasel-js/text@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- 791ba1c: Fix xychart category bands, bar and radar drag handles, timeline period moves, sankey value edits, quadrant class order, and PlotView's prop handling.
  
  - An xychart with fewer categories than values now draws the extra rows, numbered as the data table shows them, and a category label written twice gets two bands instead of stacking both rows' bars on one.
  - An xychart bar's drag handle sits on its value end when the bar runs down from the baseline: a value below a value axis that starts above zero, or any bar on a reversed axis.
  - `moveTimelinePeriod` keeps sections that had no periods before the move; it used to drop them.
  - A radar with no `max` can have a point dragged past the rim, so its largest value can grow. Before, the drag stopped at the rim. `polarScale`'s `valueAt` and `radarValueAt` take a new optional `open` argument that reads past the rim.
  - `PlotView` no longer calls `onChange` when the chart is redrawn from a new `data` prop, redraws when the `measure` prop changes, and goes back to the default theme when the `theme` prop is removed.
  - Editing a sankey link's value label and leaving it unchanged no longer rewrites the value. Before, the stored value was replaced by the rounded number the label shows (`0.30000000000000004` became `0.3`).
  - A quadrant chart keeps its classes in order when a class name is all digits; before, such a class jumped to the front when classes were moved, renamed, or read from Mermaid. `QuadrantData` gains an optional `classOrder`, set only when the keys of `classes` would lose the order, and `quadrantClassEntries` and `quadrantClassesOf` read and build the pair. Nothing breaks for consumers: `classes` keeps its type, and data without `classOrder` reads as before. Code that walks `classes` directly should use `quadrantClassEntries` to get the order right.
- Updated dependencies [7a33153]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [860ab3b]
  - @weasel-js/core@1.18.1
  - @weasel-js/text@1.18.1
  - @weasel-js/theme@1.18.1
  - @weasel-js/geom@1.18.1

## 1.18.0

### Patch Changes

- 7d409c8: Fix chart scales and Mermaid readers on edge cases
  
  - `spacedTicks` returns no ticks, rather than looping until the array overflows, where the step multiples are past counting (a domain like 1e17..1e17+100), as `ticks()` already did.
  - A time scale spanning decades ticks on 1, 2 or 5 times a power of ten years, so a 40-year span asked for 5 ticks gets 4 rather than 41.
  - A gantt date in years 0 to 99 reads as itself rather than as 1900 to 1999, and `%j` counts its day of the year from its own January.
  - A Mermaid `accDescr { … }` block closed on the line it opens on no longer swallows the statements after it.
  - A Mermaid flowchart reads an `accDescr { … }` block running over several lines instead of throwing.
  - A Mermaid xychart or sequence diagram reads past a `%%{…}%%` directive running over several lines instead of throwing.
  - A quoted front matter title reads the same in a Mermaid sequence diagram and xychart as in every other kind: escapes in double quotes read, `''` in single quotes as one quote.
  - A Mermaid packet diagram writes a gap between fields as an unlabeled field, which Mermaid reads, instead of a field Mermaid rejects for not starting where the one before ends; an unlabeled field reads back as a gap.
- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [26e836e]
- Updated dependencies [c148384]
- Updated dependencies [206b78d]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [89b2c65]
- Updated dependencies [9b7e5c7]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [c675905]
- Updated dependencies [2455bb4]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
  - @weasel-js/core@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/text@1.18.0
  - @weasel-js/theme@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [49cd9bb]
- Updated dependencies [13c6f66]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/geom@1.17.3
  - @weasel-js/text@1.17.3
  - @weasel-js/theme@1.17.3

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
