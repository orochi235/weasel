# @weasel-js/plot

Charts on weasel's scene graph. A chart is a scene node holding its spec, with
the marks it is drawn with as nodes under it, each keeping the value it stands
for; dragging a mark edits the spec.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/plot).

```sh
npm install @weasel-js/plot
```

## Two layers

**Scales, axes and marks.** A scale maps values onto a range and says which
values an axis marks and how they read: `linearScale`, `logScale`,
`bandScale`, `timeScale` (ticks on calendar units, in UTC), `ordinalScale`, and
`polarScale` (a value along each of several spokes from a center).
A linear scale also places ticks by room rather than count: `spacedTicks({
minSpacing, inset })` takes the finest 1/2/5 step that keeps neighbors
`minSpacing` apart along the range, drops any within `inset` of an end, and
returns the step and the decimals the column shares, which `formatTick` writes
every label to. The scales import on their own, with no React, DOM or scene,
from `@weasel-js/plot/scales`; a control that places values along a track calls
one with a range of `[0, 1]`.
`axisMarks` draws an axis from any of the first four: a rule, ticks, labels
measured through `@weasel-js/text`, grid lines and a title. The mark builders
(`barMark`, `spanMark`, `lineMark`, `areaMark`, `pointMark`, `arcMark`,
`ribbonMark`, `ruleMark`, `textMark`) each return a `PlotMark`: a key, a box,
and data the kit's own painters draw, with the datum under `plotMark`, so a
hit-test on a mark reaches its value.

**Chart specs.** `PlotData` is a union of chart specs on `kind`:

| Kind | Spec | Edits |
| --- | --- | --- |
| `xychart` | bar and line series over a category band or a numeric range | drag a bar's end or a line's point |
| `gantt` | tasks in sections, each starting on a date, after other tasks, or after the one before, and ending on a date, after a duration, or when another starts; `dateFormat`, `axisFormat`, `excludes`, `todayMarker` | drag a task to move its start, or its end to change its length; tasks after it follow |
| `timeline` | periods in sections, each with its events | reorder periods by dragging a label; text |
| `pie` | labeled values; `showData` | a value, typed in the legend; labels |
| `quadrant` | points from 0 to 1 on both axes, axis and quadrant labels | drag a point; text |
| `journey` | tasks in sections, each scored 1 to 5, with its actors | drag a score; text |
| `gitgraph` | commits, branches, checkouts, merges and cherry-picks, replayed into a lane per branch | tags |
| `sankey` | flows from source to target | a flow's value; node names |
| `packet` | fields of bits laid in rows (a band scale of bits) | labels |
| `radar` | curves over axes (a `polarScale`), drawn as areas | drag a point along its axis; axis labels |

Each kind also has its title edited in place.
`plotSpecs(data, { box })` compiles one to scene node specs: a group root whose
data is `{ plot: { data, theme } }`, then every mark under it, in the root's
frame. `replacePlotData` swaps a root's spec and rebuilds its marks as one undo
entry. `plotEditing({ scene })` gives the handle layer and the contribution
that bind a drag on a handle (a bar's end, a task's span) to `plot.dragValue`.
A text mark whose datum names an `edit` is the spec's text: `foldPlotText`
turns a text edit of it into one edit of the spec, and `usePlotTextEdit` gives
a `SceneCanvas` the options that do so. `PlotView` hosts one chart on a canvas
of its own with all of it wired.

Colors come from a `PlotTheme`, by role: `text`, `axis`, `grid`, and `series`,
which series take in turn. `plotThemeFrom` builds one from a resolved
`@weasel-js/theme` theme; `PLOT_THEME` is the weasel theme's dark mode.

```tsx
import { registerCanvasFont } from '@weasel-js/font';
import { PlotView, type PlotData } from '@weasel-js/plot';
import { useState } from 'react';

registerCanvasFont('sans-serif');

const SALES: PlotData = {
  kind: 'xychart',
  title: 'Sales',
  x: { kind: 'band', categories: ['jan', 'feb', 'mar'] },
  y: { title: 'Revenue', min: 0, max: 100 },
  series: [{ kind: 'bar', values: [20, 50, 80] }, { kind: 'line', values: [10, 60, 40] }],
};

export function Sales() {
  const [data, setData] = useState(SALES);
  return <PlotView data={data} onChange={setData} width={600} height={400} />;
}
```
