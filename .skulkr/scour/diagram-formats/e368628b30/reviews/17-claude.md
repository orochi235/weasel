# diagram-formats findings

## DOT writer emits `rankdir=undefined` (or a function's source) for a direction outside RANKDIR
- where: packages/diagram-formats/src/dot/write.ts:154 (writeDot)
- scenario: a JSON document (whose reader never checks `direction`) holds a graph page with `"direction": "sideways"`; `RANKDIR[page.direction]` is `undefined`, which passes the `rankdir !== null` test, so the file gets `  rankdir=undefined;`. With `"direction": "constructor"` the plain-object lookup goes up the prototype chain and writes `rankdir=function Object() { [native code] };`, which DOT cannot read back. It should look the direction up with `getOwn` and write nothing (with a warning) for a direction RANKDIR does not list.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts
- size: line
- cause: prototype-chain lookup plus a `!== null` check that lets `undefined` through
- confidence: sure

## Cross-page edges keep the exporting scene's world coordinates, which import does not reproduce
- where: packages/diagram-formats/src/toScene.ts:73 (graphSpecs); packages/diagram-formats/src/fromScene.ts:126 (documentFromScene)
- scenario: `documentFromScene` writes a cross-page edge that has an end on the pasteboard (`read({x:0,y:0})`) with its `waypoints`/`routed`/`labelPlacement` in world coordinates. `documentSpecs` appends `crossPageEdges` unshifted, but places pages with a bare `layoutPages(pageList)`: it ignores the source run's page layout, and pages that `prepared` grows (a graph page laid out on import, a sequence page) push the pages after them along. It also moves the pasteboard end node into its export page's coordinates. So after a JSON round trip of a scene whose pages are arranged by a non-default layout, or that sits after a page that grows, the edge's bends and label sit where the pages used to be, not between its ends. The coordinates should be stored relative to something that survives the round trip (for example the page of one end), or the document should carry the page arrangement.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/toScene.ts, packages/diagram-formats/src/document.ts
- size: design
- cause: world-space coordinates in an interchange document whose page placement is not preserved
- confidence: likely

## A reopened named subgraph used as an edge end connects only to the nodes named in that body
- where: packages/diagram-formats/src/dot/read.ts:141 (DotReader.end / subgraph)
- scenario: `digraph { subgraph s { b; c } a -> subgraph s { } }`. Graphviz joins `a` to every node in subgraph `s`, so it draws `a->b` and `a->c`. Here `subgraph()` returns only the ids that the current body's `walk` names (an empty set), so no edge is read. Nodes that earlier openings of `s` put in it should count too, the way `own` already carries over its attributes.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: function
- cause: subgraph membership is tracked per opening, not per named subgraph
- confidence: likely

## DOT writer puts unparseable color text verbatim inside quotes, so a `"` in it breaks the file
- where: packages/diagram-formats/src/dot/write.ts:41 (color)
- scenario: the JSON reader does not check node colors. A node with `colors: { fill: 'a"b' }` (or any CSS text paint cannot parse that contains a quote, such as `url("x")`) goes through `hexColor`, which returns unparseable text unchanged. The writer then emits `fillcolor="a"b"`, which lexes as `"a"`, `b`, then an open string, so reading the file back throws or misparses everything after it. The value needs `dotId`-style escaping, or should be dropped with a warning.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts
- size: line
- cause: unescaped interpolation into a quoted DOT string
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
