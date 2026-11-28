## An undirected DOT graph whose brace is on the next line is detected as Mermaid and misread
- where: packages/diagram-formats/src/formats.ts:23 (detectFormat)
- scenario: `readDocument('graph\n{\n  a -- b\n}\n')` (or with a `.txt` name, or `graph LR\n{ … }`, a DOT graph named LR). Mermaid's `detect` tests only the first non-empty line, `graph`, which `FLOWCHART_HEADER` accepts; DOT's `detect` also passes. With no `.dot`/`.gv` file name the first passing format in `DIAGRAM_FORMATS` wins, and Mermaid comes before DOT, so the text goes to the Mermaid flowchart reader, which throws or reads nonsense. It should be read as DOT: the token after the header is `{`, which no Mermaid flowchart has.
- evidence: read (formats.ts order + mermaid/format.ts `detect`, mermaid/common/header.ts `headerWord`)
- severity: medium
- fix: packages/diagram-formats/src/formats.ts, packages/diagram-formats/src/mermaid/format.ts
- size: function
- cause: two detectors both claim the text; the order picks the wrong one
- confidence: likely

## DOT writer writes `rankdir=undefined` (or a function's source) for a direction it does not know
- where: packages/diagram-formats/src/dot/write.ts:150 (writeDot)
- scenario: a document read from Diagram JSON (which does not validate `direction`) with `direction: "TB"` → `RANKDIR["TB"]` is `undefined`, `undefined !== null`, so the output has `rankdir=undefined;`. With `direction: "constructor"` or `"toString"` the plain-object lookup goes up the prototype chain and writes `rankdir=function Object() { [native code] };`, which Graphviz cannot parse. Should use `getOwn` and write no `rankdir` for an unknown direction.
- evidence: read
- severity: low
- size: line
- cause: plain-object lookup on an unvalidated key, `undefined` not mapped to `null`
- confidence: sure

## Diagram JSON accepts a cluster without a `members` list, which then throws in every graph writer
- where: packages/diagram-formats/src/jsonFormat.ts:41 (pageProblem)
- scenario: a JSON page with `clusters: [{ "id": "g" }]` passes validation (only `hasId` is checked), reads fine, and then `DIAGRAM_DOT.write` / Mermaid write throw `TypeError: g.members is not iterable` from `clusterTree` (`for (const m of g.members)`, graphWrite.ts:75), as does anything else iterating a cluster's members. The reader exists to say what keeps a page from being drawn, so it should reject (or default) a missing/non-array `members`; the same goes for a container's `members`/`lanes` given as a non-array (a string `members: "ab"` iterates characters).
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/jsonFormat.ts
- size: function
- cause: validation checks ids only, not the lists consumers iterate
- confidence: likely

## DOT writer drops an edge whose end is on no node or box of the page without a warning
- where: packages/diagram-formats/src/dot/write.ts:125 (edgeLine)
- scenario: a graph page (e.g. from JSON, or hand-built) with an edge `a -> z` where `z` is on another page but the edge sits in `page.data.edges` rather than `crossPageEdges`, or names a missing id. `edgeLine` returns `null` and only warns when an end is a cluster, so the connector vanishes from the export with an empty warnings list. Every other drop in the writer is reported.
- evidence: read
- severity: low
- size: line
- cause: warning branch covers only the cluster case
- confidence: sure

## `bb=""` makes the DOT reader read `pos` in points instead of inches
- where: packages/diagram-formats/src/dot/positions.ts:17 (positions)
- scenario: `graph [bb=""]` (Graphviz's way of leaving an attribute at its default, which `keyword`, `colorAttr` and `numberAttr` all read as unset) with every node given `pos="1,2"`. `str(root.graph, 'bb')` returns `''`, not `undefined`, so `unit` is 1 and the nodes are placed 72 times closer than an input file without `bb` would put them; the box then falls back to the extents. The same value is read two ways in one reader.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: line
- cause: empty string not treated as unset
- confidence: sure

## `&nbsp;` at either end of a label line is trimmed away
- where: packages/diagram-formats/src/graphRead.ts:49 (markupLines)
- scenario: a DOT HTML label `<&nbsp;&nbsp;indented>` or a Mermaid label `#nbsp;x`: entities are decoded to U+00A0 first, then each line is `.trim()`ed, and JS `trim` strips U+00A0 too, so the spacing the author wrote explicitly to survive is lost (`indented`). Only the source's own whitespace should be trimmed, before decoding.
- evidence: read
- severity: low
- size: line
- cause: trim after entity decoding
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
