## exportPageOf climbs past the page run, so a follower kept in the run exports to whichever page the whole run's bounds favor
- where: packages/diagram-formats/src/exportPage.ts:16 (exportPageOf)
- scenario: a diagram cluster (its `dependsOn` names its members) whose members sit on two pages is placed in the page run (`placeOnPages`: "a node following others goes … else into the page run"). `documentFromScene` → `pageOf(cluster)` → `pageIdOf` is null (the run is not a page), so the loop climbs to the outermost ancestor, the page run node itself, and `documentBoundsOf(run)` spans every page; `pageHolding` then answers from the bounds of all pages, not from the cluster's own box, putting the cluster (and its `itemPage`) on an arbitrary page. It should stop below page structure (`isPageStructure`) and measure the node's own outermost non-structure ancestor.
- evidence: read (core `pageIdOf`, `contentRoots`, `placeOnPages` doc)
- severity: medium
- fix: packages/diagram-formats/src/exportPage.ts
- size: line
- cause: ancestor walk does not stop at page structure
- confidence: likely

## A named subgraph used as an edge end connects only the nodes named in that statement, not the subgraph's earlier members
- where: packages/diagram-formats/src/dot/read.ts:150 (DotReader.end / subgraph)
- scenario: `digraph { subgraph s { a; b }  subgraph s {} -> c }`. Graphviz joins every node of subgraph `s` to `c` (a->c, b->c). `end()` returns only the ids `walk` named in the reopening's own statements, which here is none, so no edges are read at all.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: function
- cause: edge end set built from the statement, not the subgraph's membership
- confidence: likely

## DOT writer puts a color it cannot parse into a quoted attribute without escaping it
- where: packages/diagram-formats/src/dot/write.ts:43 (color)
- scenario: a document color that `tryParseColor` rejects (e.g. a JSON document holding `colors.fill: 'a"b'` or any string with a quote or backslash) goes through `hexColor` unchanged and is written as `fillcolor="a"b"`, which `readDot` then fails to parse (or reads as a different color). Unlike labels and ids, nothing escapes it, and nothing warns that the color is not drawable.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts
- size: line
- cause: unescaped value in quoted attribute
- confidence: sure

## Inverted DOT arrowheads (`inv`, `oinv`, `invempty`) are read as forward-pointing markers with no warning
- where: packages/diagram-formats/src/dot/values.ts:142 (ARROWS)
- scenario: `a -> b [arrowhead=inv]` draws a triangle pointing back at the tail in Graphviz; the table maps `inv` to `'arrow'` (and `oinv`/`invempty` to `triangle-hollow`), so the import silently points it the other way, while every other arrowhead the diagram cannot draw is reported under "DOT arrowheads drawn as arrows".
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/values.ts, packages/diagram-formats/src/dot/read.ts
- size: line
- cause: lossy mapping without warning
- confidence: sure

## documentSpecs' doc says an unplaced graph page is laid out "with `layered`", but it uses the page's own `layout`, and lays out a page whose nodes are all placed when it has an unboxed pool or empty container
- where: packages/diagram-formats/src/toScene.ts:62 (documentSpecs doc comment)
- scenario: a page with `layout: { name: 'tree' }` is laid out with `tree` (`laidOutPage` reads `page.layout?.name ?? 'layered'`), and a page whose nodes all have `at` but holding a pool with no `box` is laid out too (`needsLayout`), contrary to "A graph page whose nodes all have a place is drawn where they say".
- evidence: read
- severity: low
- size: line
- cause: stale doc comment
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
