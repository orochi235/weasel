# Findings: diagram-formats

## DOT writer drops a graph page's `layout` and `notation` without a warning
- where: packages/diagram-formats/src/dot/write.ts:150 (writeDot)
- scenario: a graph page with `layout: { name: 'tree' }` or `notation: 'class'` written with DIAGRAM_DOT. Only `direction` is written (as `rankdir`), and neither `graphOut` nor `writeDot` adds a warning, so the page reads back as a layered flowchart. Every other thing DOT can't hold (bends, trims, marks, ports, cross-page edges) gets a warning.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts, packages/diagram-formats/src/graphWrite.ts
- size: line
- cause: page settings missing from the shared drop warnings
- confidence: likely

## `readMarks` stops at the first missing mark index and drops every later mark
- where: packages/diagram-formats/src/markReaders.ts:61 (readMarks)
- scenario: a shape drawn with marks `<id>/mark:0..2`, then mark node `<id>/mark:1` is removed from the scene (a delete, or an op that rebuilds only some marks). The loop returns when `scene.get('<id>/mark:1')` is undefined, so `mark:2` is silently missing from the exported DataNode. It should read every mark child.
- evidence: read
- severity: low
- size: function
- cause: index probe in place of a child walk
- confidence: likely

## A JSON document whose `version` is NaN or a fraction is read as version 2
- where: packages/diagram-formats/src/jsonFormat.ts:63 (read)
- scenario: `{"format":"weasel-diagram","version":1.5,...}` (a NaN can't come from JSON.parse, but a non-integer or negative number can). It passes `typeof === 'number'` and `> VERSION` is false, then `version < 2` picks the upgrade path by plain comparison: 1.5 gets upgraded as v1 and 0 or -3 do too, with no error for a version that never existed. Non-integer and below-1 versions should be refused, the way a version newer than the reader is.
- evidence: read
- severity: low
- size: line
- cause: version checked for type only, not for being a known integer
- confidence: sure

## `bb=""` makes DOT `pos` read as points, not inches
- where: packages/diagram-formats/src/dot/positions.ts:17 (positions)
- scenario: `digraph { bb=""; a [pos="1,1"]; b [pos="2,1"] }`. `str(root.graph,'bb')` is `''`, which is not `undefined`, so `unit` is 1 and the positions are taken as points: a 72× shrink. The box then falls back to the node extents. Every other attribute in read.ts treats `""` as unset (Graphviz's default), so `bb=""` should give the inch unit too.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: line
- cause: empty-string attribute not treated as unset
- confidence: sure

## The JSON reader copies unknown top-level keys into the document
- where: packages/diagram-formats/src/jsonFormat.ts:84 (read)
- scenario: a file with extra top-level fields (`{"format":..., "version":2, "pages":[...], "foo": {...}}`). `const { format, version, ...document } = json` keeps `foo` on the returned DiagramDocument, and the next `write` spreads it back out, so junk survives round trips. The reader also checks nothing past `pages`, `crossPageEdges` and `theme`. Only DiagramDocument's own keys should be picked.
- evidence: read
- severity: low
- size: line
- cause: rest-spread of unvalidated input
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
