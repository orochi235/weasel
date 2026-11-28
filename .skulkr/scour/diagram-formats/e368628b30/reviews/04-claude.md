## DOT writer puts an unparseable color string inside quotes unescaped, producing DOT that does not parse
- where: packages/diagram-formats/src/dot/write.ts:45 (color)
- scenario: a document (e.g. read from Diagram JSON, whose colors are not validated) holds a node `colors.fill` that paint cannot parse and that contains a `"`, such as `url("#g")`. `hexColor` returns the string unchanged (`if (!rgba) return css`), and `color()` writes `fillcolor="url("#g")"`. That ends the quoted string early, so `parseDot` throws on the output. The writer should escape the value, as `dotId` does, or drop the color and warn.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts
- size: line
- cause: value interpolated into quotes without escaping
- confidence: sure

## DOT writer drops a graph page's `layout` without a warning
- where: packages/diagram-formats/src/dot/write.ts:143 (writeDot)
- scenario: a graph page has `layout: { name: 'force' }` or `'tree'`, plus layout options. `writeDot` writes only `rankdir` from `direction`. The page's layout name and its options (`nodeGap`, `rankGap`, …) are not written and no warning is added, even though every other loss (ports, bends, trims, marks) gets one. When read back, the page lays out as `layered`. The writer should warn, or map the layout to a Graphviz `layout=`/`nodesep`/`ranksep`.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts, packages/diagram-formats/src/graphWrite.ts
- size: line
- cause: page setting with no warning on the lossy path
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

<!-- done: 2 findings, files read: 39 -->
