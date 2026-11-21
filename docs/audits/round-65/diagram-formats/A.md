I couldn't write `.skulkr/out/findings.md`: the first write went through, but every later write to it was refused permission. As the brief says, the whole document is below instead.

# Audit round 65: diagram-formats findings

## `documentFromScene` drops a shape's marks, silently
- where: packages/diagram-formats/src/sceneReaders.ts:145 (readShape)
- scenario: open a Diagram JSON page whose node has `marks: [{ d: 'M0 0 L1 1' }]`. `documentSpecs` draws each mark as a child `<id>/mark:<i>` (packages/diagram/src/fromData.ts:240). `readShape` never reads those children: `slotRows` even filters them out by that prefix. So `documentFromScene` returns the node with no `marks`, and saving the file back deletes them. No warning is given: the "has no marks" warnings in graphWrite.ts:114 and drawXml/writeStyle.ts:67 never fire for a document read from a scene. What should happen is that the marks are read back as `DataNode.marks`.
- evidence: read (no reader of `diagram.mark` anywhere in the package's sources except the slot filter)
- severity: medium

## Opening and saving a document deletes the hidden rows of a collapsed node
- where: packages/diagram-formats/src/sceneReaders.ts:145 (readShape); packages/diagram-formats/src/toScene.ts:75 (documentSpecs)
- scenario: a JSON node `{ rows: [header, field, field], collapsed: true }`. `documentSpecs` → `diagramScene` builds the body from `rowsOf(n)`, which returns only the header for a folded node (fromData.ts:88–89, used at :196). The scene therefore holds only the header row, and nothing records `collapsed`. `documentFromScene` then reads a node with one header row and no `collapsed`, so a JSON round trip loses the folded rows for good and the node comes back expanded. What should happen is that the rows and the flag survive the round trip.
- evidence: read
- severity: medium

## `documentFromScene` drops a container's `reorder` axis, but keeps a cluster's
- where: packages/diagram-formats/src/sceneReaders.ts:280 (readRegion)
- scenario: `{ containers: [{ id: 'k', role: 'container', members: ['a','b'], reorder: 'y' }] }`. `diagramScene` puts `reorder: 'y'` on the region's `diagram.container` trait (packages/diagram/src/containers/regionSpecs.ts:52). `readRegion` never reads `container.reorder`, so the field is lost on any export and read back. `readCluster` (:330) does read the same field for a cluster, so the two kinds of box give different answers to the same question.
- evidence: read
- severity: medium

## A DOT HTML label's `<BR ALIGN="LEFT"/>` is dropped instead of breaking the line
- where: packages/diagram-formats/src/graphRead.ts:52 (markupLines), reached from dot/values.ts:21 (htmlLines)
- scenario: `a [label=<one<BR ALIGN="LEFT"/>two>]`. The regex `/<br\s*\/?>/gi` matches only a bare `<br>`, `<br/>` or `<br />`. A `<BR>` that carries attributes is stripped as an ordinary tag, so the node reads as one line, `onetwo`, where Graphviz draws two lines, `one` and `two`. `ALIGN` on `BR` is standard Graphviz HTML-label syntax.
- evidence: read
- severity: medium

## A DOT `pos` on a node with no `width`/`height` is placed using Graphviz's 54×36 default size, then drawn at the diagram's own size, so its center moves
- where: packages/diagram-formats/src/dot/read.ts:166 (positions), :149–156 (readNode)
- scenario: `digraph { a [pos="100,100"]; b [pos="300,100"] }`. `positions` turns each center into a top-left corner using a 54×36 box. `readNode` leaves `width`/`height` unset, so `fromData` sizes the node at `MIN_WIDTH` (64) or wider, and at its measured height (fromData.ts:210). The corner stays where it was, so every node's center lands right of and below the `pos` it was given. What should happen is either that the assumed size is written onto the node, or that the corner is worked out from the size the node is actually drawn at.
- evidence: read
- severity: low

## `scenePageKinds` with `opts.page` on a scene with no page list neither narrows to one page nor throws
- where: packages/diagram-formats/src/pageKinds.ts:25 (scenePageKinds)
- scenario: a scene with no page run, `scenePageKinds(scene, { page: 'x' })`. The `placed.length > 0` guard skips the `RangeError` and returns the kinds of every page. For the same scene, `writtenPage(documentFromScene(scene), { page: 'x' })` throws, because the only page is `page-1`. The doc comment promises the throw "as `writtenPage` does", so a menu shows a format as able to write a page that the writer then refuses.
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
packages/diagram-formats/src/exportPage.ts
packages/diagram-formats/src/formats.ts
packages/diagram-formats/src/fromScene.ts
packages/diagram-formats/src/graphPageMeta.ts
packages/diagram-formats/src/graphRead.ts
packages/diagram-formats/src/graphWrite.ts
packages/diagram-formats/src/index.ts
packages/diagram-formats/src/jsonFormat.ts
packages/diagram-formats/src/lineError.ts
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

<!-- done: 6 findings, files read: 36 -->