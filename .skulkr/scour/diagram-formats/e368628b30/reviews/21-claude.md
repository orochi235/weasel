# diagram-formats findings

## DOT writer drops a graph page's `notation` and `layout` with no warning, where Mermaid warns
- where: packages/diagram-formats/src/dot/write.ts:150 (writeDot)
- scenario: write a graph page with `notation: 'class'` (or `'er'`, `'state'`) and/or `layout: { name: 'force' }` and unplaced nodes (a JSON document) with `DIAGRAM_DOT.write`. The DOT text carries neither, and `warnings` says nothing; reading it back gives a plain flowchart laid out `layered`. `writeMermaid` answers the same question with "Mermaid has no X diagram; the page was written as a flowchart." DOT should warn the same way (and for a non-default layout on a page it writes without `pos`).
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts, packages/diagram-formats/src/graphWrite.ts
- size: line
- cause: graphOut's shared warnings omit page settings
- confidence: sure

## A laid-out page grows to hold node and region boxes only, so routes and labels layout places past them fall off the page
- where: packages/diagram-formats/src/pageLayout.ts:86 (laidOutPage)
- scenario: import a DOT/Mermaid graph with a self-loop or an orthogonal edge that layout routes around the outermost node, or an edge label beside the last rank. `right`/`bottom` are computed from `boxes` (nodes and containers), not from `routed` points or `labelPlacement.at.near`, so the page ends `PAGE_MARGIN` past the last box and the route/label can sit outside the page (and export clipped by `exportPageSvg`'s page rect). Same for the top/left shift, which only looks at boxes.
- evidence: read
- severity: low
- size: function
- cause: page extent ignores edge geometry
- confidence: likely

## DOT writer writes a color paint cannot parse raw and silent, which its own reader then drops
- where: packages/diagram-formats/src/dot/write.ts:43 (color) / packages/diagram-formats/src/graphWrite.ts:133 (hexColor)
- scenario: a node with `colors: { fill: 'var(--brand)' }` (or any string `tryParseColor` rejects). `hexColor` returns it unchanged, `color()` writes `fillcolor="var(--brand)"` with no warning, Graphviz reads it as an unknown color (black/warning), and `readDot` drops it with "DOT colors a diagram cannot draw were dropped". The writer should warn (or omit) where the reader already does.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/graphWrite.ts
- size: line
- cause: unparseable colors pass through hexColor unchecked
- confidence: likely

## JSON reader accepts duplicate page ids, which the document says share one namespace
- where: packages/diagram-formats/src/jsonFormat.ts:61 (read)
- scenario: `{"format":"weasel-diagram","version":2,"pages":[{"id":"p","width":10,"height":10,"data":{"nodes":[],"edges":[]}},{"id":"p",...}]}` reads without error; `documentSpecs`/`createPageRun` then get two pages with one id, and `writtenPage(doc,{page:'p'})` silently picks the first. `read` validates every other page field but not id uniqueness (nor node ids across pages, `PageBase` doc: "Ids share one namespace across the whole document"), so the failure surfaces later and far from the file.
- evidence: read
- severity: low
- size: function
- cause: validation skips id uniqueness
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

<!-- done: 4 findings, files read: 39 -->
