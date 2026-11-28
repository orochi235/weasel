# diagram-formats: blind review findings

## documentFromScene silently loses a sequence or plot root that is not its page's own root
- where: packages/diagram-formats/src/fromScene.ts:110 (documentFromScene)
- scenario: a sequence root placed inside a container (or a second sequence root on a page that already has one) is read as `kind === 'sequence'`, fails `roots.get(page.id)?.id === node.id`, and hits `continue`. The page is left a graph page (as `pageRootsOf` says), but nothing of the sequence lands in it, and there is no warning channel to report the loss. A plot root nested in a container does the same: `kindOf` answers `null` for it, so the label branch skips it. Exporting to JSON and reading the file back drops the diagram. The document should either carry it or the loss should be reported.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/pageRoots.ts
- size: function
- cause: non-page-root sequence/plot roots have no path into a graph page
- confidence: likely

## DOT writer drops a page's layout, notation and connector routers without a warning
- where: packages/diagram-formats/src/dot/write.ts:150 (writeDot)
- scenario: a graph page with `layout: { name: 'tree' }`, `notation: 'class'`, or edges with `router: 'orthogonal'` is written as plain DOT. Nothing is warned, although every other loss (ports, bends, trims, marks, dash patterns) is. Reading the file back gives a layered flowchart with straight connectors, and the caller was never told. It should warn, as `graphOut` does for the other dropped fields. Graphviz's `splines=ortho` and `layout=` could also carry some of these.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/graphWrite.ts
- size: function
- cause: missing warnings for page settings and router
- confidence: sure

## Cross-page edges kept in world coordinates misalign once pages are laid out again on import
- where: packages/diagram-formats/src/toScene.ts:83 (documentSpecs)
- scenario: `documentFromScene` writes a connector with a pasteboard end that exports to another page into `crossPageEdges`, with its waypoints in the source scene's world coordinates. Those coordinates depend on how the source page run laid out its pages (`layoutPages(pages, doc.layout)`, as `addTemplatePage` uses). The document does not carry that layout, and `documentSpecs` places pages with default `layoutPages(pageList)`. For a source scene whose run uses a non-default layout, the nodes move with their pages but the waypoints stay where they were, so the route no longer meets its ends.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/document.ts
- size: design
- cause: world-space waypoints without the page layout they were measured in
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

<!-- done: 3 findings, files read: 39 -->
