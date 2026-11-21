# Audit round 63 — diagram-formats.drawXml

Note: the checkout's HEAD is 6f634fabe1; the brief's commit 1b4edb3a93db… is not in this repository, so this
review read the working tree as it stands.

## The `bar` marker is written as draw.io's `dash`, which is a diagonal slash, and `dash` reads back as a perpendicular bar
- where: packages/diagram-formats/src/drawXml/mapping.ts:113 (MARKERS_READ `dash`), :128 (MARKERS_WRITE `bar`)
- scenario: an edge with `markerEnd: 'bar'` is written `endArrow=dash;endFill=1`. The kit's `bar` is a tick across
  the line (`poly([0, -1.5, 0, 1.5])` in packages/stroke/src/strokeMarkerShapes.ts:144). mxGraph's `dash` marker is
  drawn from `pe - n/2 + perp/2` to `pe - 3n/2 - perp/2`: a stroke at 45° to the line. So the file draws a slash
  where the diagram drew a tick, and a draw.io file's `dash` reads in as a tick. The perpendicular tick is `ERone`,
  which the reader already maps to `bar`; the writer should write `bar` as `ERone`, and `dash` should not read as `bar`.
- evidence: read (mapping.ts, strokeMarkerShapes.ts); the shape of mxGraph's `dash` marker is from mxMarker.js, recalled, not opened here
- severity: medium

## `absoluteArcSize=1` is ignored, so a rounded box is read as a stadium or round rect by the wrong measure
- where: packages/diagram-formats/src/drawXml/readStyle.ts:28 (outlineOf)
- scenario: with `absoluteArcSize=1`, draw.io reads `arcSize` as pixels (corner radius `arcSize / 2`), not as a percent
  of the shorter side. `rounded=1;absoluteArcSize=1;arcSize=50` on a 200×150 box draws 25 px corners, but reads as
  `stadium` because 50 ≥ `STADIUM_ARC`. `rounded=1;absoluteArcSize=1;arcSize=40` on a 200×40 box draws a full stadium
  (radius 20 = half the height), but reads as `roundRect`. The reader should compare `arcSize / 2` with half the
  shorter side when the flag is set.
- evidence: read (code); the meaning of absoluteArcSize is from mxGraph, recalled
- severity: low

## A shape the reader does not know is drawn as a round rect with no warning when its style also says `rounded=1`
- where: packages/diagram-formats/src/drawXml/readStyle.ts:28-29 (outlineOf)
- scenario: `shape=step;rounded=1;` (or any unknown `shape=` together with `rounded=1`) returns at line 28 as
  `roundRect`/`stadium` before line 29 runs, so the "Shapes of kind "step" were drawn as rects." warning never fires.
  The same shape without `rounded=1` warns. The shape is replaced either way; only one path says so.
- evidence: read
- severity: low

## The writer cannot tell a container from a pool, so a container holding one tall container reads back as a pool with one lane
- where: packages/diagram-formats/src/drawXml/pageCells.ts:38-46 (holdsLanes); packages/diagram-formats/src/drawXml/writeStyle.ts:68-78 (regionStyle)
- scenario: `regionStyle` writes a container, a pool and a lane with the same style (`swimlane;horizontal;startSize;container=1;…`).
  On read, `holdsLanes` calls a swimlane a pool when every swimlane child spans at least 90% of its body across the
  stack. Take a container (header on top) whose only member is a container with tall content: the outer is roughly
  `header + padding + inner + padding` high, so for an inner height past about nine times the padding the inner
  spans ≥ 90% of `height − startSize`. It reads back as `role: 'pool'` with one lane, and the inner container's
  members become lane members. Nothing in the written file lets the reader tell them apart. Writing a mark the reader
  checks first, such as draw.io's own `childLayout=stackLayout` on a pool, would fix it.
- evidence: inference from code; I did not run a write→read round trip
- severity: medium

## A cluster whose members all sit in an earlier cluster is nested inside it and takes those members, though the earlier cluster should keep them
- where: packages/diagram-formats/src/drawXml/writePage.ts:44-53 (parentsOf)
- scenario: `clusters: [{ id: 'A', members: ['a','b','c'] }, { id: 'B', members: ['a','b'] }]`. `DataCluster` says a
  member a later cluster also names stays in the earlier one, so the diagram draws a, b, c in A and B empty. When B is
  processed, `held` is `{A}`, so the branch meant for a region runs: B is parented under A, and a and b are taken from
  A into B. The file holds A ⊃ {c, B ⊃ {a, b}}, which reads back as a nesting the document never had. That branch
  should apply only when the single holder is a container, pool or lane, not a cluster.
- evidence: read (writePage.ts; the DataCluster doc at packages/diagram/src/dataTypes.ts:103-105)
- severity: low

## The `avoid` router is written as a plain orthogonal edge with no warning
- where: packages/diagram-formats/src/drawXml/writeStyle.ts:98 (edgeStyle)
- scenario: an edge with `router: 'avoid'` is written `edgeStyle=orthogonalEdgeStyle` and reads back as
  `router: 'orthogonal'`. The obstacle-avoiding router is replaced silently, where every other setting the format
  cannot hold (trims, marks, own ports, unknown markers) gets a warning on this same path.
- evidence: read
- severity: low

## An HTML label keeps literal newlines and runs of spaces, which the draw app collapses
- where: packages/diagram-formats/src/drawXml/cellText.ts:8-24 (htmlText), :28 (cellLines)
- scenario: an `html=1` value `"First part\nsecond part"` (as pasted HTML often carries), or `"a    b"`. draw.io lays
  out an HTML label as HTML, so it shows `First part second part` on one line and `a b`. `htmlText` leaves the `\n`
  in, and `cellLines` splits on it, so the node reads as two lines; the extra spaces are kept too. Only `<br>` and
  block elements should break a line in HTML text, and runs of whitespace should fold to one space.
- evidence: read
- severity: low

## A dragged connector label on a self-loop with no bends loses its offset without a warning
- where: packages/diagram-formats/src/drawXml/readStyle.ts:168-178 (labelPlacementOf), :137-155 (pointAlong)
- scenario: an edge whose source and target are the same cell, with no waypoints and a label carrying
  `<mxPoint as="offset" x="40" y="-30"/>`. The line is center-to-center, so its total length is 0 and `pointAlong`
  returns `undefined`. The function falls through to the fraction branch, which drops `offset` entirely: the label
  reads as `mid` on the loop, and no warning says the position was lost.
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

<!-- done: 8 findings, files read: 14 -->
