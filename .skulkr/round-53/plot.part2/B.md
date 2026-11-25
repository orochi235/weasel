## An xychart drag runs a value past a fixed value-axis end, where the radar's and quadrant's drags hold it inside
- where: packages/plot/src/xychart/editor.ts:35 (xyEditor.drag), packages/plot/src/xychart/edit.ts:23 (xyValueAt)
- scenario: take an xychart with `y: { max: 100 }` and a bar at 80, and drag the bar's end 200 px above the plot's top. `xyValueAt` is `value.invert(along)` with no clamp, so the spec gets 130, or whatever value the pointer is at. The bar is drawn cut at 100 (`place` clamps, ruled 2026-11-10), so the bar stays pinned at the rim while the spec holds a value the axis never shows. A fixed `y.min` does the same below. The radar handles this differently: `radarEditor.drag` passes `open = data.max === undefined`. With a set rim, `polarScale.valueAt` clamps the value into the domain, and only an auto-fitted rim lets a drag raise it. Quadrant clamps too (`quadrantValueAt`). Expected: with a set `y.min`/`y.max` the drag holds the value to that end, as radar does. Past an auto-fitted end it may grow.
- evidence: read
- severity: medium

## Setting only one value-axis end past the data flips an xychart's value axis
- where: packages/plot/src/xychart/compile.ts:60-63 (xyValueDomain)
- scenario: take values all in 0..10 and `y: { min: 100 }` with no `max`. The missing end comes from the data's nice reach (`niceHi` = 10), so the domain is `[100, 10]`: the value axis runs downward and bars hang from the top. `y: { max: -5 }` over positive data gives `[0, -5]` the same way. The type doc says a missing end "fits the series' values", but here it lands on the wrong side of the set end and flips the chart. Radar handles the same case the other way: `radarDomain` starts its fitted `max` at `min` (`data.max ?? min`), so a fitted end never falls on the far side of a set one. Expected: the fitted end lies beyond the set end, so the axis never flips.
- evidence: read
- severity: low

## The sankey's typed flow accepts hex, binary and octal literals, which the pie's typed value rejects
- where: packages/plot/src/sankey/editor.ts:10-14 (flowOf)
- scenario: when editing a link's value label in place, typing `0x10` sets the flow to 16, `0b11` sets 3 and `0o7` sets 7, because `flowOf` is `Number(text.trim())`. The pie's in-place value edit (`pieValueOf`, pie/edit.ts) uses a strict decimal regex instead: it returns `null` for these inputs and leaves the spec unchanged. Expected: typed chart numbers are read one way, with non-decimal literals rejected as in pie.
- evidence: read
- severity: low

## Files read
packages/plot/src/packet/schema.ts
packages/plot/src/packet/structure.ts
packages/plot/src/packet/types.ts
packages/plot/src/pbt.fixture.ts
packages/plot/src/pie/compile.ts
packages/plot/src/pie/edit.ts
packages/plot/src/pie/editor.ts
packages/plot/src/pie/schema.ts
packages/plot/src/pie/structure.ts
packages/plot/src/pie/types.ts
packages/plot/src/plotData.ts
packages/plot/src/plotScene.ts
packages/plot/src/quadrant/compile.ts
packages/plot/src/quadrant/edit.ts
packages/plot/src/quadrant/editor.ts
packages/plot/src/quadrant/schema.ts
packages/plot/src/quadrant/structure.ts
packages/plot/src/quadrant/types.ts
packages/plot/src/radar/compile.ts
packages/plot/src/radar/edit.ts
packages/plot/src/radar/editor.ts
packages/plot/src/radar/schema.ts
packages/plot/src/radar/structure.ts
packages/plot/src/radar/types.ts
packages/plot/src/sankey/compile.ts
packages/plot/src/sankey/edit.ts
packages/plot/src/sankey/editor.ts
packages/plot/src/sankey/layout.ts
packages/plot/src/sankey/schema.ts
packages/plot/src/sankey/structure.ts
packages/plot/src/sankey/types.ts
packages/plot/src/theme.ts
packages/plot/src/timeline/compile.ts
packages/plot/src/timeline/edit.ts
packages/plot/src/timeline/editor.ts
packages/plot/src/timeline/schema.ts
packages/plot/src/timeline/structure.ts
packages/plot/src/timeline/types.ts
packages/plot/src/xychart/compile.ts
packages/plot/src/xychart/edit.ts
packages/plot/src/xychart/editor.ts
packages/plot/src/xychart/schema.ts
packages/plot/src/xychart/structure.ts
packages/plot/src/xychart/types.ts

<!-- done: 3 findings, files read: 44 -->