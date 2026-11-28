# diagram-formats findings

## An edge to a reopened subgraph joins only the nodes named in that statement, not every node of the subgraph
- where: packages/diagram-formats/src/dot/read.ts:153 (DotReader.end)
- scenario: `digraph { subgraph s { a } subgraph s { b } -> c }` — Graphviz takes a subgraph operand as the whole subgraph (its nodes from every opening), so it draws `a -> c` and `b -> c`; the reader returns only the ids `walk` saw in this opening (`b`), so `a -> c` is lost with no warning
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: function
- cause: subgraph operand's nodes taken from one statement, not kept per named subgraph
- confidence: likely

## DOT positions are read back to 2 decimals although the writer writes 4, so a placed page moves on a round trip
- where: packages/diagram-formats/src/dot/positions.ts:4 (round), packages/diagram-formats/src/dot/positions.ts:27 (positions)
- scenario: a node at `at.x = 10.004` writes `pos="…"` at four places (`dotNumber`); `positions` reads it through `round` (two places) and the node comes back at `10`; widths go through the same `round` in `readNode`. Write → read is not the identity for any coordinate with a third decimal
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/positions.ts, packages/diagram-formats/src/dot/read.ts
- size: line
- cause: reader rounds coarser than writer
- confidence: sure

## Invisible nodes decide whether the page keeps its positions and how big it is, though they are left out of it
- where: packages/diagram-formats/src/dot/read.ts:362 (readDot)
- scenario: `digraph { a [pos="0,0"]; b [pos="1,1"]; h [style=invis] }` — `positions` runs over every node before invisible ones are filtered, so `h` with no `pos` makes it return `null`: the visible nodes' places are dropped (with a "pos dropped" warning) and the page is laid out. With `h` given a far `pos` and no `bb`, the page box stretches to hold a node that is not on it
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: line
- cause: invisible filter applied after positions
- confidence: sure

## The DOT writer drops a page's layout silently
- where: packages/diagram-formats/src/dot/write.ts:150 (writeDot)
- scenario: a graph page with `layout: { name: 'force' }` or `{ name: 'tree', options: { rankGap: 80 } }` writes only `rankdir`; nothing names the layout or its options and no warning says they were dropped, while every other thing DOT cannot hold (routes, trims, ports, marks) is warned about in `graphOut`
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/graphWrite.ts
- size: line
- cause: no warning for page.layout in graphOut
- confidence: sure

## Cross-page connectors keep waypoints in the source scene's world, but import places pages in a different world
- where: packages/diagram-formats/src/fromScene.ts:132 (documentFromScene), packages/diagram-formats/src/toScene.ts:62 (graphSpecs)
- scenario: a scene whose page run uses a non-default page layout (pages stacked vertically, or another gap) has a connector from a pasteboard shape to a shape on another page; it is exported to `crossPageEdges` with waypoints and label point in that scene's world coordinates, while its ends are exported page-relative. `documentSpecs` places the pages with `layoutPages(pageList)` (the default layout, since the document carries none) and adds the cross-page edge unshifted, so its bends and label land away from the ends they joined
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/toScene.ts, packages/diagram-formats/src/document.ts
- size: design
- cause: world coordinates tied to a page placement the document does not record
- confidence: likely

## A sequence root that is not its page's root is dropped from the export entirely
- where: packages/diagram-formats/src/fromScene.ts:117 (documentFromScene)
- scenario: a sequence diagram inside a group or container (`pageRootsOf` skips it, so its page stays a graph page), or a second sequence on a page: `kind === 'sequence'` hits `continue` without setting `bucket.sequence`, so the diagram is in no page and nothing reports it lost; the exported graph page has its group but not the sequence it held
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/fromScene.ts
- size: function
- cause: non-root sequences neither exported nor reported
- confidence: likely

## Files read
packages/diagram-formats/src/colorCheck.ts
packages/diagram-formats/src/document.ts
packages/diagram-formats/src/dot/format.ts
packages/diagram-formats/src/dot/lex.ts
packages/diagram-formats/src/dot/parse.ts
packages/diagram-formats/src/dot/positions.ts
packages/diagram-formats/src/dot/read.ts
packages/diagram-formats/src/dot/values.ts
packages/diagram-formats/src/dot/write.ts
packages/diagram-formats/src/dot/x11.ts
packages/diagram-formats/src/exportPage.ts
packages/diagram-formats/src/formats.ts
packages/diagram-formats/src/fromScene.ts
packages/diagram-formats/src/graphPageMeta.ts
packages/diagram-formats/src/graphRead.ts
packages/diagram-formats/src/graphWrite.ts
packages/diagram-formats/src/index.ts
packages/diagram-formats/src/jsonFormat.ts
packages/diagram-formats/src/lineError.ts
packages/diagram-formats/src/markReaders.ts
packages/diagram-formats/src/pageKinds.ts
packages/diagram-formats/src/pageLayout.ts
packages/diagram-formats/src/pageRoots.ts
packages/diagram-formats/src/pageSvg.ts
packages/diagram-formats/src/pbt.fixture.ts
packages/diagram-formats/src/plotPages.ts
packages/diagram-formats/src/rowLines.ts
packages/diagram-formats/src/sceneReaders.ts
packages/diagram-formats/src/sequencePage.ts
packages/diagram-formats/src/shiftData.ts
packages/diagram-formats/src/templates/catalog.ts
packages/diagram-formats/src/templates/starters.ts
packages/diagram-formats/src/templates/templateScene.ts
packages/diagram-formats/src/testing/asGraph.ts
packages/diagram-formats/src/testing/authoredScene.ts
packages/diagram-formats/src/testing/docScene.ts
packages/diagram-formats/src/testing/pageScene.ts
packages/diagram-formats/src/testing/samePage.ts
packages/diagram-formats/src/toScene.ts

<!-- done: 6 findings, files read: 39 -->
