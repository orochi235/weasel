# Audit round 63 — diagram-formats.drawXml

## Draw-style XML claims only `.xml`, so the chart app's Import picker cannot choose a `.drawio` file
- where: packages/diagram-formats/src/drawXml/format.ts:20 (DIAGRAM_DRAW_XML.extensions)
- scenario: the draw app saves `diagram.drawio` by default. `apps/chart/src/importExport.tsx:50` builds the file picker's `accept` from every readable format's `extensions` (`.diagram.json,.xml,...`), so a `.drawio` file is grayed out in the picker even though `detect` recognizes its `<mxfile>` root and `readDrawXml` reads it. Export also names the file `.xml`, which the draw app does not open by double-click. Should list `.drawio` (and `.drawio.xml`) alongside `.xml`.
- evidence: read
- severity: medium

## The writer's font style ignores `weight`, header rows, and every row after the first
- where: packages/diagram-formats/src/drawXml/writeStyle.ts:42-51 (fontBits, fontParts)
- scenario: (a) a label row with `style: { weight: 700 }` (which `RowTextStyle` documents as taking over `bold`) is written with no `fontStyle`, so it reads back regular; one with `{ bold: true, weight: 400 }` is drawn regular but written `fontStyle=1`. (b) A node whose only text row is a `header` with `{ fontSize: 16, bold: true }` writes no font at all, since `fontParts` looks only at `label` and `field` rows while `rowLines` still writes the header's text. (c) Rows with different styles all take the first one's on the way back (`textOf` applies one style to every line), with no warning, though every other lossy case on this path warns.
- evidence: read
- severity: medium

## An HTML label's literal newlines and runs of spaces are read as line breaks and kept, where the draw app collapses them
- where: packages/diagram-formats/src/drawXml/cellText.ts:9-32 (htmlText, cellLines)
- scenario: a cell with `html=1` and `value="Order&#10;placed"` (a newline in HTML source, as a hand-edited or generated file has) renders in the draw app as `Order placed` on one line, since HTML whitespace collapses; `cellLines` splits it at the `\n` into two lines. Likewise `a   b` in HTML reads with three spaces. Only `<br>` and block elements should break lines in HTML mode, and whitespace runs should collapse to one space.
- evidence: read
- severity: low

## A `UserObject` label with `placeholders="1"` is read with its `%name%` placeholders unsubstituted
- where: packages/diagram-formats/src/drawXml/cells.ts:75-77 (rawCell)
- scenario: `<UserObject label="%owner%'s task" owner="Ana" placeholders="1">` draws `Ana's task` in the draw app; the reader takes the `label` attribute verbatim, so the node reads `%owner%'s task`. Placeholders should be filled from the wrapper's own attributes (as the draw app does, `%id%` excepted from user attributes), or at least warned about.
- evidence: read
- severity: low

## `absoluteArcSize=1` is ignored, so a rounded box with a pixel arc reads as the wrong outline
- where: packages/diagram-formats/src/drawXml/readStyle.ts:28 (outlineOf)
- scenario: `rounded=1;absoluteArcSize=1;arcSize=40` on a 120×40 box is a stadium in the draw app (radius 20 = half the height), but `arcSize` is read as a percent: 40 < 50 → `roundRect`. Conversely `absoluteArcSize=1;arcSize=60` on a 400×200 box is a gently rounded rect read as a `stadium`. The arc should be compared against the box when `absoluteArcSize` is set.
- evidence: read
- severity: low

## An empty pool is written as a swimlane the reader takes for a plain container
- where: packages/diagram-formats/src/drawXml/writeStyle.ts:68-78 (regionStyle) with packages/diagram-formats/src/drawXml/pageCells.ts:350-358 (holdsLanes)
- scenario: a `role: 'pool'` container with `lanes: []` (or with lanes that the scene gives no box) is written as `swimlane;...` with no swimlane children; on reading, `holdsLanes` returns false for no lanes, so it comes back `role: 'container'`, silently changing role and axis. The writer should mark a pool in the style (as it does `weaselDirection` on the model), or the reader should honor such a mark.
- evidence: read
- severity: low

## A moved edge label on a self-loop or zero-length line loses its offset silently
- where: packages/diagram-formats/src/drawXml/readStyle.ts:137-155,168-178 (pointAlong, labelPlacementOf)
- scenario: an edge from a node to itself with no waypoints has `line = [c, c]`; a label with `<mxPoint as="offset" x="0" y="-30"/>` gets `pointAlong` → `undefined` (total length 0), so the fallback branch returns `{ at: 'mid' }` with only `geo.y` as offset: the 30 px drag is dropped with no warning.
- evidence: read
- severity: low

## Files read
packages/diagram-formats/src/drawXml/cellText.ts
packages/diagram-formats/src/drawXml/cells.ts
packages/diagram-formats/src/drawXml/format.ts
packages/diagram-formats/src/drawXml/mapping.ts
packages/diagram-formats/src/drawXml/pageCells.ts
packages/diagram-formats/src/drawXml/read.ts
packages/diagram-formats/src/drawXml/readPage.ts
packages/diagram-formats/src/drawXml/readStyle.ts
packages/diagram-formats/src/drawXml/style.ts
packages/diagram-formats/src/drawXml/write.ts
packages/diagram-formats/src/drawXml/writeEdge.ts
packages/diagram-formats/src/drawXml/writePage.ts
packages/diagram-formats/src/drawXml/writeStyle.ts
packages/diagram-formats/src/drawXml/writeXml.ts

<!-- done: 7 findings, files read: 14 -->
