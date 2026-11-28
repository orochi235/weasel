# diagram-formats findings

## `decodeEntities` reads a named reference spelled `&x<hex>;` as a hex character reference
- where: packages/diagram-formats/src/graphRead.ts:45 (decodeEntities)
- scenario: DOT HTML label `<a &xa; b>` or Mermaid text holding `&xa;` / `&xcafe;`. The `&` branch's `[a-z]+` alternative (case-insensitive) matches `xa`, and the next test `/^#?x([\da-f]+)$/i` has an optional `#`, so the bare `xa` counts as hex. `&xa;` becomes U+000A (a line break inside `markupLines`), and `&xcafe;` becomes U+CAFE. Neither is a real entity, so both should stay as written, the way any other unknown name (`&foo;`) does.
- evidence: read
- severity: low
- size: line
- cause: `#?` lets a named ref take the hex path
- confidence: sure

## An edge to a reopened named subgraph joins only the nodes named in that occurrence
- where: packages/diagram-formats/src/dot/read.ts:166 (DotReader.end / subgraph)
- scenario: `digraph { subgraph s { a b } x -> subgraph s { } }`. Graphviz joins `x` to every node of subgraph `s` (a and b), because the subgraph keeps its nodes. Here `end` uses the `named` set that `walk` returns for this occurrence's statements only. That set is empty, so no edges are made. `this.named` keeps the subgraph's own attribute defaults across occurrences but not its member nodes.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: function
- cause: subgraph membership not kept across reopenings
- confidence: likely

## Cross-page edges keep world-coordinate waypoints, but the document drops the page layout those coordinates assume
- where: packages/diagram-formats/src/fromScene.ts:122 (documentFromScene), packages/diagram-formats/src/toScene.ts:105 (documentSpecs)
- scenario: Take a scene whose page run uses a non-default page layout (for example pages stacked vertically, or a different gap; `addTemplatePage` reads it as `doc?.layout`). A connector whose end sits on the pasteboard goes in `crossPageEdges` with `waypoints`/`routed` in world coordinates (`read({x:0,y:0})`). `DiagramDocument` has no field for the page layout. `documentSpecs` places pages with the default `layoutPages(pageList)` and appends `crossPageEdges` unshifted. On re-import the pages move, but those bends stay at the old world positions, away from the nodes they join. The JSON round trip also changes the page arrangement itself.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/document.ts, packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/toScene.ts
- size: design
- cause: world coordinates kept without the frame that defines them
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
