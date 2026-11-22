# Audit round 70 — diagram-formats

## DOT `detect` rejects valid DOT whose header tokens are separated only by a comment, or whose quoted id continues a line
- where: packages/diagram-formats/src/dot/format.ts:35 (DIAGRAM_DOT.detect), :9 (ID)
- scenario: `digraph/* x */G { a }` or `strict/**/digraph { a }`: `detect` replaces each comment with `''`, so the text becomes `digraphG {` / `strictdigraph {`, KEYWORD's lookahead (or `strict\s+`) fails, and `detect` returns false, though `readDot` reads the file (the lexer treats a comment as a separator). Likewise `digraph "a\<newline>b" {`: COMMENTS keeps the quoted string (its `\\[\s\S]` allows the escaped newline), but ID's `\\.` doesn't match a newline, so `detect` fails while `lexDot` reads the line continuation. `readDocument` then throws "is not a diagram file this package reads" for a file DOT reads. The fix is to replace a comment with `' '`, not `''`, and use `\\[\s\S]` in ID.
- evidence: read
- severity: low

## Diagram JSON reader checks crossPageEdges' items, but never a page's nodes or edges
- where: packages/diagram-formats/src/jsonFormat.ts:38-41 (pageProblem) vs :62 (read)
- scenario: `{"format":"weasel-diagram","version":2,"pages":[{"id":"p","width":10,"height":10,"data":{"nodes":[null],"edges":[{"to":1}]}}]}` passes `read`, since only `Array.isArray(d.nodes)` is checked. The document it returns then throws a TypeError deep in `documentSpecs` or `diagramScene` (`n.id` of null), or draws an edge with a non-string end. The same file with that edge under `crossPageEdges` is refused with a clear message (`isEdge`). One rule, applied two ways: page edges should get the same `isEdge` check, and nodes a string `id` check.
- evidence: read
- severity: low

## Diagram JSON with no `version` is refused as "newer than this reader's"
- where: packages/diagram-formats/src/jsonFormat.ts:48-50 (read)
- scenario: a document with `"format":"weasel-diagram"` but no `version` (or `"version":"2"`) throws `A weasel diagram document of version undefined, newer than this reader's 2`. The message names the wrong cause; the file isn't newer, its version is missing or not a number. Also, `NaN` can't come out of JSON, but `version: -1` or `1.5` passes and is upgraded as v1, which is fine. Only the non-number branch is wrong.
- evidence: read
- severity: low

## documentFromScene puts a connector in crossPageEdges when one end is a shape it left out
- where: packages/diagram-formats/src/fromScene.ts:106-111, 119-129 (documentFromScene)
- scenario: a shape sits on a page that is a plot page or a sequence page ("whatever else is on it is left out"), with a connector to a shape on another page. `itemPage` is set for the left-out shape (line 107) before the page's kind is known, so the edge passes the `fromPage/toPage` check and goes into `crossPageEdges`. The end it names is on no page of the document. The JSON format writes this dangling edge, and every graph writer warns "connectors to other pages were dropped" for it. The edge should be dropped with its end, as an edge with both ends on that page already is: its bucket is discarded.
- evidence: read
- severity: low

## Files read
packages/diagram-formats/src/colorCheck.ts
packages/diagram-formats/src/document.ts
packages/diagram-formats/src/dot/format.ts
packages/diagram-formats/src/dot/lex.ts
packages/diagram-formats/src/dot/parse.ts
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

<!-- done: 4 findings, files read: 38 -->
