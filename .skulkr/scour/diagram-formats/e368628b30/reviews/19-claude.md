# diagram-formats findings

## Cross-page edges keep source-world waypoints, but import re-places pages with the default page layout
- where: packages/diagram-formats/src/toScene.ts:96 (documentSpecs)
- scenario: a scene whose page run uses a non-default layout (`direction: 'column'`, another gap or origin; `pagesOf(scene).layout`, which `addTemplatePage` honors) has a connector with one end on the pasteboard. `documentFromScene` writes it to `crossPageEdges` with its waypoints and label point in that scene's world coordinates (`readEdge(..., { x: 0, y: 0 })`). `documentSpecs` places the pages with `layoutPages(pageList)` and no options, and `addDocumentScene` calls `createPageRun` without the old layout, so the pages land somewhere else (a row instead of a column) while the edge's waypoints are drawn unshifted. The connector bends through points far from both of its ends. The document carries no page layout, so the reader cannot recover the frame those coordinates were in. Fix: either write cross-page waypoints relative to a page, or carry the page layout in the document and apply it in `documentSpecs` and `addDocumentScene`.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/toScene.ts, packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/document.ts
- size: design
- cause: world coordinates with no recorded page layout
- confidence: likely

## DOT `grayN`/`greyN` misses Graphviz's value by one for some N (gray50, gray90)
- where: packages/diagram-formats/src/dot/values.ts:79 (x11Color)
- scenario: `color=gray50`: the formula `Math.round(50 * 2.55)` = `Math.round(127.5)` = 128 gives `#808080`, but Graphviz's X11 table (rgb.txt) has gray50 = 127 (`#7f7f7f`). The same happens for gray90: the formula gives 230 (`#e6e6e6`) where the table has 229 (`#e5e5e5`). Other levels match (gray10 = 26, gray30 = 77, gray70 = 179), so a rounding formula cannot reproduce the table. The file header says `x11.ts` comes from rgb.txt; the gray ramp should come from it too, as a table.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/x11.ts
- size: function
- cause: formula in place of rgb.txt table
- confidence: likely

## JSON reader accepts duplicate page ids, and the import then throws
- where: packages/diagram-formats/src/jsonFormat.ts:59 (read)
- scenario: a `weasel-diagram` file with two pages whose `id` is `"p"`. `read` validates each page on its own and returns the document with no warning. Opening it (`documentSpecs` → `layoutPages`) throws `layoutPages: two pages have the id "p"`. `DiagramFormat.read` is documented to throw on text it cannot read, so the read itself should refuse this, with the format's own message. Node ids shared across pages are likewise unchecked, although `PageBase` documents one id namespace for the whole document.
- evidence: read (layoutPages, packages/core/src/core/pages/pages.ts:70)
- severity: low
- size: function
- cause: per-page validation only
- confidence: sure

## JSON reader passes sequence and plot pages' data unchecked
- where: packages/diagram-formats/src/jsonFormat.ts:28 (pageProblem)
- scenario: `{"kind":"sequence", ..., "data":{}}` or a plot page whose `data` lacks its kind and series. `pageProblem` checks only that `data` is an object (graph pages get their lists checked). `read` succeeds, and a TypeError is thrown later, deep in `sequenceLayout` or `plotSpecs`, when the document is opened. The reader should report it the way it reports a graph page with no `nodes` list.
- evidence: read
- severity: low
- size: function
- cause: validation covers graph pages only
- confidence: likely

## Laying out an unplaced page sizes and shifts it from node boxes only, ignoring routes and label points
- where: packages/diagram-formats/src/pageLayout.ts:86 (laidOutPage)
- scenario: a page with no places is laid out, and an orthogonal or avoiding route (or a placed edge label: `labelPlacement.at.near`) bends outside the bounding box of its nodes, for example a route around a node in the top row. `min`, `right` and `bottom` come only from node and container boxes, so that route keeps a negative coordinate after the shift, or runs past the grown page's right or bottom edge. Part of the connector is drawn off the page and is cut off by page exports. The extent should include `routed` points and label points.
- evidence: read
- severity: low
- size: function
- cause: page extent omits edge geometry
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

<!-- done: 5 findings, files read: 39 -->
