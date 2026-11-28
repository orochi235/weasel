# diagram-formats findings

## markupLines trims the no-break spaces `&nbsp;` decodes to, so `&nbsp;` indentation in a label is lost
- where: packages/diagram-formats/src/graphRead.ts:52 (markupLines)
- scenario: a Mermaid label `"&nbsp;&nbsp;child"`, or a DOT HTML label `<&nbsp;&nbsp;child>` (htmlLines in dot/values.ts calls markupLines), is decoded first: `NAMED.nbsp` is U+00A0 (verified by grep). Then `.map((l) => l.trim())` runs, and `String.prototype.trim` strips U+00A0. The line reads `child`. Spelling out `&nbsp;` is the usual way to force leading or trailing space in an HTML-ish label, and both Graphviz and Mermaid draw it. The trim should take only the source whitespace, applied before entities are decoded, or trim ASCII whitespace only.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/graphRead.ts
- size: line
- cause: trim runs after entity decoding
- confidence: sure

## `bb=""` makes `pos` read as points rather than inches, while every other attribute reads `""` as unset
- where: packages/diagram-formats/src/dot/positions.ts:17 (positions)
- scenario: `digraph { bb=""; a [pos="1,2"]; b [pos="3,2"] }`. `str(root.graph, 'bb')` is `''`, which is not `undefined`, so `unit` is 1 and `pos` is read in points. `box` is then `[0]`, so the code falls back to the node extents. Nodes meant to be 144 pt apart end up 2 pt apart, overlapping. The reader's `keyword`, `colorAttr` and `numberAttr` all treat `""` as Graphviz's default (unset), and Graphviz does the same for `bb`. So the same question, whether `""` counts as set, gets two answers in one reader.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/positions.ts, packages/diagram-formats/src/dot/read.ts
- size: line
- cause: empty-string attribute treated as set
- confidence: sure

## Invisible DOT nodes are read before they are filtered out, so their shapes, outlines, colors and sizes produce warnings about nodes that are dropped anyway
- where: packages/diagram-formats/src/dot/read.ts:374 (readDot)
- scenario: `digraph { a [style=invis, shape=star, color="/blues9/3"] }`. `readNode` runs for every node before `unseen` is computed. The result carries "DOT shapes read as rectangles: star", "DOT colors a diagram cannot draw were dropped: /blues9/3" and "DOT invisible nodes and edges were left out: a". The first two describe changes to a node that is never in the document. Only the invisible-node warning should appear. Filtering `unseen` before mapping `readNode` fixes it. That needs `positions` fed the invisible nodes' sizes separately, since Graphviz's `pos`/bbox include them.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: function
- cause: read-then-filter order
- confidence: sure

## documentFromScene silently drops a plot or sequence root nested inside a group or container on a graph page
- where: packages/diagram-formats/src/fromScene.ts:102 (documentFromScene)
- scenario: a sequence root that is a child of a container on page 1. `pageRootsOf` counts only content roots, so page 1 stays a graph page. Its `kindOf` is `'sequence'`, and the loop `continue`s without setting `bucket.sequence` because `roots.get(page.id)?.id !== node.id`. A nested plot root has `kindOf` `null` and is skipped too. The container's `membersOf` takes only shapes and containers. So the chart or sequence disappears from the exported document, and every format writes it out without a warning. `documentFromScene` has no warnings channel to report it. The doc comment says only that the page stays a graph page, not that the content is deleted.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/pageRoots.ts
- size: design
- cause: nested roots match no reader and have no warning path
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
