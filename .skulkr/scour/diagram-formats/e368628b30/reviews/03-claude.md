## DOT style words other than filled/rounded/dashed/dotted/invis are dropped without a warning
- where: packages/diagram-formats/src/dot/read.ts:213 (readNode; also readEdge, readCluster via stylesOf/dashOf)
- scenario: `a [style=bold]`, `a -> b [style="bold,tapered"]`, `node [style=diagonals]`, `style=striped` on a cluster → the words are read by `stylesOf`, nothing reads them, and no warning is raised; every other attribute a diagram does not hold is listed under "DOT attributes a diagram does not hold were dropped". `bold` in particular changes the drawn width (Graphviz draws it as penwidth 2), so the import silently draws a thinner line.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts, packages/diagram-formats/src/dot/values.ts
- size: function
- cause: style list read for known words only, unknown words never reported
- confidence: sure

## A connector to a container on the written page that leaves for another page is dropped with no warning
- where: packages/diagram-formats/src/graphWrite.ts:104 (graphOut)
- scenario: a document whose `crossPageEdges` holds an edge from container `k` (on the page being written) to a node on page 2 → the "holds one page; connectors to other pages were dropped" check tests `byId` (nodes only), so it is false, and the edge is never written either; the writer reports nothing. The same edge from a node on the page does warn.
- evidence: read
- severity: low
- size: line
- cause: page membership checked against nodes only, not `tree.clusterIds`
- confidence: sure

## The JSON reader accepts ids repeated across pages (and repeated page ids), which the document model forbids
- where: packages/diagram-formats/src/jsonFormat.ts:58 (read / pageProblem)
- scenario: a `.diagram.json` with two pages each holding node `a`, or two pages with id `p` → `read` returns it with no warning or error, though `PageBase` says ids share one namespace across the document; `documentSpecs` then feeds both `a`s to one `diagramScene` call, so one node overwrites or collides with the other when the scene is built, far from the reader that could have named the problem. `pageProblem` validates every other structural requirement up front.
- evidence: read
- severity: low
- size: function
- cause: uniqueness of ids not validated
- confidence: likely

## DOT `pos` placement measures the page from invisible nodes that are then removed
- where: packages/diagram-formats/src/dot/read.ts:357 (readDot), packages/diagram-formats/src/dot/positions.ts:19 (positions)
- scenario: a neato input graph (no `bb`) with every node given `pos`, one of them `style=invis` far to the left → `positions` takes the page's left/top and size from all nodes including the invisible one, then `readDot` filters it out, so the visible nodes sit offset with empty space where the invisible node was. Likewise an invisible node with no `pos` makes `positions` return `null` and the whole graph is re-laid out, discarding every visible node's `pos` with a "pos dropped" warning.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: function
- cause: invisible nodes filtered after placement instead of before
- confidence: sure

## DOT `pos` with an empty coordinate reads it as 0
- where: packages/diagram-formats/src/dot/positions.ts:19 (positions)
- scenario: `a [pos="1,"]` (or `pos=",2"`) → `Number('')` is 0 and finite, so the node is placed at y (or x) 0 rather than the pos being refused and the page laid out, as it is for `pos="1"`.
- evidence: read
- severity: low
- size: line
- cause: `Number('')` treated as a valid coordinate
- confidence: sure

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

<!-- done: 5 findings, files read: 39 -->
