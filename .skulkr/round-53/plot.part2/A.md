I couldn't write `.skulk/out/findings.md` because the write was refused, so the whole findings document is below.

# Findings: plot.part2 (round 53, blind reviewer)

## xychart flips its value axis when only one end is set and the data lies on the other side of it, where radar answers the same case with a unit span
- where: packages/plot/src/xychart/compile.ts:60-63 (xyValueDomain)
- scenario: all series values are in 1..5, so the auto domain is [0, 5]. The schema's optional "Y from" field is set to 10 and "Y to" is left to fit. Then `min = 10` and `max = niceHi = 5`, so the domain is [10, 5]. The axis runs upside down and every bar hangs from the top. A "Y to" set below every value does the same: `max: -3` over positive values gives [0, -3]. radar handles the identical case in `radarDomain` (radar/compile.ts:33-37): it keeps the set end and spans one unit past it (`max === min ? [min, min + 1]`), and never reverses. Setting one end should not invert the chart.
- evidence: read
- severity: medium

## insertPacketField accepts a field that overlaps the one before it, breaking the module's no-overlap invariant
- where: packages/plot/src/packet/structure.ts:16-21 (insertPacketField)
- scenario: the module's own contract (lines 1-4) says fields stay in bit order and never overlap. Take fields `[{0-7}, {8-15}]` and call `insertPacketField(data, 1, { start: 2, end: 5, label: 'x' })`. `room` only pushes later fields along, and `field.start` is never checked against `data.fields[at-1].end`. The result is `[{0-7}, {2-5}, {8-15}]`, which overlaps. The Mermaid writer then drops that field with an overlap warning. `setPacketStart`, by contrast, throws on the same condition.
- evidence: read
- severity: low

## A series object listed twice in an xychart draws both bar series in the same slot
- where: packages/plot/src/xychart/compile.ts:138 (seriesMarks, `bars.indexOf(series)`)
- scenario: `const s = { kind: 'bar', values: [1, 2] }`, then `series: [s, s]`. Bars are sized `slotWidth / 2`, but `indexOf` returns 0 for both copies. Both series draw at offset 0 and the second half of every slot stays empty. The offset should come from a running bar count, not from looking the series up by identity.
- evidence: read
- severity: low

## sankey layout is quadratic in nodes × links on every compile
- where: packages/plot/src/sankey/layout.ts:87-88, 104-105, 141 (orderColumns `into`/`outOf`, `ins`/`outs`, ribbons `offsets`)
- scenario: each node's in-flows and out-flows, each sweep's neighbor weights (4 sweeps × 2 directions), and each node's ribbon stack all rescan the full `edges` list. `offsets` also allocates `edges.map(...)` for every node. With 5k nodes and 10k links that is about 10^8–10^9 edge visits per `compileSankey`, and compile reruns on every text edit and replace. Adjacency lists built once would make all of these linear in links.
- evidence: read
- severity: low

## Two parsers for "a non-negative number typed into a label": sankey takes hex, binary and octal, pie does not
- where: packages/plot/src/sankey/editor.ts:10-14 (flowOf)
- scenario: sankey's `flowOf` is a bare `Number(t)`, so `0x10` typed into a link's value label sets the flow to 16, and `0b11` sets it to 3. The pie legend value goes through `pieValueOf` (pie/edit.ts:18-24), which accepts only decimal with an optional exponent, so it rejects `0x10`. The same decision gets two answers.
- evidence: read
- severity: low

## Row edits on an xychart write zeros into series that were shorter than the rows, which turns missing points into drawn zeros
- where: packages/plot/src/xychart/structure.ts:20-25 (eachRow, used by insertXyRow, removeXyRow, moveXyRow)
- scenario: categories `[a, b, c, d]` and a line series `values: [1, 2]`. Compile draws only 2 points. `removeXyRow(data, 0)` first pads the series to 4 rows with zeros, so the series becomes `[2, 0, 0]` and the line now drops to zero at c and d. Those points did not exist before the edit. An edit to an unrelated row invents data.
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

<!-- done: 6 findings, files read: 44 -->