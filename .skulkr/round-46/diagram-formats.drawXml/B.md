# Audit round 46 — diagram-formats.drawXml (blind reviewer)

## A vertex's relative geometry under another vertex is read as pixels, not fractions of its parent
- where: packages/diagram-formats/src/drawXml/cells.ts:72 (geometryOf), packages/diagram-formats/src/drawXml/pageCells.ts:91 (originOf)
- scenario: a draw-style file holds a vertex child of a vertex with `<mxGeometry x="1" y="0.5" width="20" height="20" relative="1"><mxPoint x="-10" y="-10" as="offset"/></mxGeometry>` (how a draw app writes a BPMN boundary event or a port-like child on a 200×100 task). In a draw app `x`/`y` of a relative vertex geometry are fractions of the parent's width and height, plus the `offset` point, so the child sits at parent + (190, 40). `geometryOf` keeps `x`/`y` as written for any relative geometry and `originOf` adds them as pixels, ignoring `offset`, so the child is placed at parent + (1, 0.5) — near the parent's top-left corner. The relative branch exists only for edge labels (`kindOf === 'label'` short-circuits `originOf`), but `geometryOf` applies it to every relative cell.
- evidence: read (code); draw-app semantics of relative vertex geometry from mxGraph's model, not run
- severity: medium

## An edge label's `offset` point is never read, so a dragged label loses its position
- where: packages/diagram-formats/src/drawXml/readStyle.ts:121 (labelPlacementOf), packages/diagram-formats/src/drawXml/readPage.ts:138 (readEdge)
- scenario: an edge-label child cell `<mxGeometry x="0.2" relative="1"><mxPoint x="30" y="-25" as="offset"/></mxGeometry>`, as a draw app writes it after the label is dragged off the line. `labelPlacementOf` reads only the geometry's `x` and `y` attributes; the `<mxPoint as="offset">` child is ignored, so the label reads as sitting on the line at 0.6 of the way along with no offset, rather than 30/−25 px off it. `cells.ts` has no reader for an `offset` point at all.
- evidence: read
- severity: low

## A stock draw-app triangle (pointing east) reads as the diagram's triangle, its `direction` ignored
- where: packages/diagram-formats/src/drawXml/mapping.ts:41 (SHAPES, `triangle`), packages/diagram-formats/src/drawXml/readStyle.ts:19 (outlineOf)
- scenario: the writer spells `triangle` as `triangle;direction=north;`, which shows the mapping knows a bare `triangle` in a draw app points east. The read entry has no `when` on `direction`, so `triangle;` (east), `triangle;direction=south;` and `direction=west` all read as `triangle` with no warning, and draw rotated from how the file shows them. The same holds for `trapezoid`, written with `direction=north` and read under any direction.
- evidence: read
- severity: low

## `segmentEdgeStyle` connectors read as straight, though a draw app routes them at right angles
- where: packages/diagram-formats/src/drawXml/mapping.ts:91 (ORTHOGONAL_EDGE_STYLES), packages/diagram-formats/src/drawXml/readStyle.ts:83 (routerOf)
- scenario: an edge with `edgeStyle=segmentEdgeStyle;` (a draw app's manually segmented orthogonal connector) is not in `ORTHOGONAL_EDGE_STYLES`, so `routerOf` answers `'straight'` and the connector is drawn diagonally between its waypoints instead of at right angles.
- evidence: read (code); that SegmentConnector routes orthogonally is from mxGraph's edge styles, not run
- severity: low

## Multi-line edge, container, pool, and lane labels lose their line breaks on read, though the writer keeps them
- where: packages/diagram-formats/src/drawXml/readPage.ts:33 (labelOf)
- scenario: a document with a container labeled `"Billing\nTeam"` or an edge labeled `"yes\n(90%)"` is written with the `\n` kept (`regionLabel`, `edgeXml` value, escaped as `&#10;`). Reading it back, `labelOf` joins `valueLines` with `' '`, so the label becomes `"Billing Team"`. Node text keeps its lines (`textOf`), so the same value reads two ways depending on the cell kind, and write→read is not a round trip for these labels. Same for a draw-app file whose swimlane or edge label has `<br>`.
- evidence: read (whether the diagram draws `\n` in an edge or region label as a break: inference, not checked)
- severity: low

## A swimlane with no `startSize` is measured as having no header, so a small pool reads as a container of containers
- where: packages/diagram-formats/src/drawXml/pageCells.ts:39 (holdsLanes)
- scenario: a draw app gives a swimlane with no `startSize` a non-zero default header. A pool 200 high whose lanes fill its body (200 − header ≈ 177 each, header-on-top columns) fails `lane.height >= (200 − 0) * 0.9 = 180`, so `holdsLanes` answers false: the pool reads as a `container` and its lanes as nested containers rather than a pool with lanes. Larger pools pass, so the result depends on size.
- evidence: read (draw app's default `startSize` value from mxGraph constants, not run)
- severity: low

## A generated fallback cell id can equal a real id, and the two cells are then conflated
- where: packages/diagram-formats/src/drawXml/cells.ts:39 (rawCell), packages/diagram-formats/src/drawXml/pageCells.ts:61 (pageCells byId)
- scenario: a graph model whose third cell has no `id` and another cell has `id="cell-3"`. Both become `RawCell`s with id `cell-3`; `byId` keeps the later one, so `parent="cell-3"` and edge `source="cell-3"` resolve to whichever came last, and a child of the other is placed against the wrong origin or an edge attaches to the wrong shape. `claim` renames one id in the output, but the references were already resolved against the merged map. The fallback should be fresh against the ids present.
- evidence: read
- severity: low

## A group holding only containers is dropped with no warning
- where: packages/diagram-formats/src/drawXml/readPage.ts:83 (groupMembers), packages/diagram-formats/src/drawXml/readPage.ts:88 (keptGroups)
- scenario: a top-level draw-app `group` whose children are two swimlane containers. `groupMembers` counts only shapes and kept groups, so the group has none and is not kept; `keptGroups` warns only for groups inside a region, so nothing is reported. The grouping vanishes silently, and an edge ending on the group is dropped under the unrelated warning "Connectors with a loose end, or with an end on another connector".
- evidence: read
- severity: low

## Two end labels at the same end keep one silently, where two mid labels warn
- where: packages/diagram-formats/src/drawXml/readPage.ts:132 (readEdge, endLabels)
- scenario: an edge with two label children both at `x="-1" relative="1"`. `Object.fromEntries` keeps the last for `from` with no warning, while the mid-label path warns "Connectors with more than one label kept only the first." The two paths settle extra labels two ways (last wins silently vs first wins with a warning).
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

<!-- done: 9 findings, files read: 14 -->
