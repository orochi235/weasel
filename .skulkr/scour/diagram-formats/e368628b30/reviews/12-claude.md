# diagram-formats — blind review findings

## A DOT end naming both a port and a compass point loses the compass point the diagram has
- where: packages/diagram-formats/src/dot/read.ts:279 (portOf)
- scenario: `digraph { a:p:n -> b }` (or `tailport="p:n"`). `portOf` gets `port = 'p'`, `compass = 'n'`. Because `port !== undefined`, it warns "DOT ports a diagram does not have were dropped: a:p:n" and returns `undefined`, so the edge leaves from no port. The diagram has an `n` port, so the record field `p` is what should drop and `n` should stay, the way `a:n` alone reads as `fromPort: 'n'`.
- evidence: read
- severity: low
- size: line
- cause: compass discarded whenever a named port is present
- confidence: sure

## DOT compass point `c` is reported as a dropped port even though it means "no port"
- where: packages/diagram-formats/src/dot/read.ts:279 (portOf)
- scenario: `a:c -> b`. `COMPASS_POINTS` accepts `c`, so the parser sets `compass: 'c'`. `portOf` treats only `_` as "no port", so `c` falls through to the warning "DOT ports a diagram does not have were dropped: a:c". Graphviz draws `c` as the center, the same as no port, so nothing was lost, but the import still reports a loss.
- evidence: read
- severity: low
- size: line
- cause: `c` not treated like `_`
- confidence: sure

## The DOT writer drops a page's layout and notation without a warning
- where: packages/diagram-formats/src/dot/write.ts:150 (writeDot)
- scenario: a graph page with `layout: { name: 'force' }` or `notation: 'class'` written as DOT and read back comes back as a plain layered flowchart. Nothing in `ExportResult.warnings` says so, while every other field the writer cannot hold (routes, trims, ports, marks, groups, pools) gets a warning from `graphOut`.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts, packages/diagram-formats/src/graphWrite.ts
- size: line
- cause: no warning for page settings DOT can't carry
- confidence: sure

## Cross-page edges kept whole are redrawn at world coordinates from a different page layout
- where: packages/diagram-formats/src/toScene.ts:62 (graphSpecs)
- scenario: `documentFromScene` writes a cross-page edge with an end on the pasteboard with its waypoints in the exporting scene's world coordinates (`read({x:0,y:0})`, fromScene.ts:132). `documentSpecs` places pages with a default `layoutPages(pageList)` after `prepared()` may have grown earlier pages (a laid-out graph page or a sequence page). It then appends `crossPageEdges` unshifted. If the exporting run used a non-default layout (column direction, another gap or origin), or an earlier page grew on import, those waypoints land away from both ends.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/toScene.ts
- size: design
- cause: world coordinates aren't tied to the page layout that produced them
- confidence: likely

## The JSON reader accepts duplicate page ids that then make opening the document throw
- where: packages/diagram-formats/src/jsonFormat.ts:56 (read)
- scenario: a `.diagram.json` with two pages both `"id": "p"` passes every `read` check and returns an `ImportResult`. `documentSpecs` then calls `layoutPages`, which throws `layoutPages: two pages have the id "p"` (core pages.ts:70). The format contract says `read` "throws on text this format cannot read", so the reader should refuse it with its own message. Instead the open fails later with an error from core.
- evidence: read (traced into core `layoutPages`)
- severity: low
- size: line
- cause: page-id uniqueness not validated
- confidence: sure

## The DOT writer can write `pos="NaN,…"`, which turns the whole page back into one that needs layout
- where: packages/diagram-formats/src/dot/write.ts:55 (nodeAttrs), packages/diagram-formats/src/dot/values.ts:171 (dotNumber)
- scenario: `placed` checks only that `at`, `width` and `height` are defined. A node with a non-finite `at.x` (a JSON-sourced page can carry one) gets `pos="NaN,…"`. `dotNumber` returns `String(NaN)`. On reading back, `positions` sees a non-finite center and returns `null`, so every node's position is dropped (warning `pos`) and the page is laid out again. `penwidth`, `width` and `height` guard with `Number.isFinite`; `pos` and `bb` don't.
- evidence: read
- severity: low
- size: line
- cause: missing finiteness guard on pos/bb
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
