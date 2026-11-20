# Audit round 46 — diagram-formats.drawXml (blind reviewer)

Note: commit 6438325dbfdd7d007274232811abe60fc38c4f12 is not in this clone; the tree read is HEAD
782733b19c, whose `packages/diagram-formats/src/drawXml/` has no uncommitted changes.

## Lanes are written with `fillColor=none`, so their themed body fills are lost, and reading the file back pins every lane fill to transparent
- where: packages/diagram-formats/src/drawXml/writeStyle.ts:73 (regionStyle)
- scenario: a pool whose lanes take the theme's striped `lane.bodies` fills (dataRegionStyle with laneIndex), or a lane with `colors.fill` set. `colorParts(..., false)` writes `fillColor=none` for every lane, so draw.io shows no lane stripes, which contradicts write.ts's promise that each item is written in the colors it is drawn in. Reading it back, readStyle's `colorOf` turns `none` into `fill: 'transparent'` on every lane (readPage.ts:77), so a write→read round trip replaces the themed lane fill with an explicit transparent override. Expected: write the lane's computed fill, as for containers and pools.
- evidence: read (dataRegionStyle in packages/diagram/src/dataStyles.ts:45 gives lanes a body fill; no test covers lane fill)
- severity: medium

## A cluster's `label` is dropped on write with no warning
- where: packages/diagram-formats/src/drawXml/writePage.ts:71 (vertices)
- scenario: `clusters: [{ id: 'g', members: ['a','b'], label: 'Team' }]`. The group cell is written with `value: ''`, so the label vanishes and `warnings` says nothing; every other dropped feature (marks, own ports, trims, rows) warns. Expected: write the label as the group cell's value (readGroup would then read it), or warn that cluster labels were left out.
- evidence: read
- severity: medium

## A container that carries `lanes` loses those lanes' members from the file entirely
- where: packages/diagram-formats/src/drawXml/writePage.ts:38-41 (parentsOf), :66-70 (vertices)
- scenario: a `role: 'container'` region with a `lanes` array (a pool switched to container, or data built by hand; the diagram treats lanes as pool-only, e.g. applyEdit.ts:102). vertices() writes lanes only for pools, so `lane.id` is not in `known`, yet `claim(m, lane.id)` never checks that the holder is known, and records the lane as the parent of every lane member. emit() only descends into written cells, so `children.get(lane.id)` is never visited and those nodes are silently missing from the output, and so is every edge to them ("ends are not on their page"). Expected: claim a member only under a holder that is written.
- evidence: read
- severity: low

## `arrow-concave` is written as `classic`, which reads back as `arrow`
- where: packages/diagram-formats/src/drawXml/mapping.ts:95,112 (MARKERS_READ / MARKERS_WRITE)
- scenario: an edge with `colors.markerEnd: 'arrow-concave'` writes `endArrow=classic;endFill=1`; reading it, `classic` maps to `arrow`, which edgeColorsOf then drops as the default. So a write→read round trip silently changes the marker. The two tables answer what `classic` means in two different ways. Expected: read `classic` as `arrow-concave` (and `block` as `arrow`), so each name means the same thing in both directions.
- evidence: read
- severity: low

## Two end labels on the same end of an edge: one is dropped with no warning
- where: packages/diagram-formats/src/drawXml/readPage.ts:128-132 (readEdge)
- scenario: an edge with two child label cells, both at relative `x="-1"`. `Object.fromEntries` keeps the last and drops the first silently, while the parallel case of extra mid-edge labels warns ("kept only the first"). Expected: the same warning, keeping the first.
- evidence: read
- severity: low

## A group holding only containers, or only shapes nested under shapes, is dropped silently, and edges to it get the wrong warning
- where: packages/diagram-formats/src/drawXml/readPage.ts:83-101 (groupMembers / keptGroups)
- scenario: a draw.io group whose direct children are swimlanes (or a shape whose own child shapes are the content). `groupMembers` counts only direct `shape`/kept `group` children, so the group is not kept and no warning is emitted (keptGroups warns only for groups inside a region). A connector ending on that group is then dropped with "Connectors with a loose end…", which misdescribes what happened. Expected: warn that the group was dropped.
- evidence: read
- severity: low

## Cells that are later dropped still claim ids in the document's id space
- where: packages/diagram-formats/src/drawXml/readPage.ts:170-172 (readPage)
- scenario: page 1 has a group `g` inside a swimlane (dropped) or a loose-ended edge `e` (dropped); page 2 has a shape with id `g` or `e`. The id was claimed for the dropped cell on page 1, so page 2's shape is renamed `page-2:g` even though no item in the document uses `g`. Expected: claim ids only for the cells that are kept.
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
