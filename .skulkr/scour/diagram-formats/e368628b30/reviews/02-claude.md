## documentFromScene drops a shape's header band and header text colors
- where: packages/diagram-formats/src/sceneReaders.ts:194 (readShape)
- scenario: a class box (header row) whose `colors` set `header: '#ff0000'` and/or `headerText: '#00ff00'` is drawn by `diagramScene` (the band's paint goes on the node's `headerFill`, the title's on the header row's fill via `rowTextColor`, packages/diagram/src/dataColors.ts:42-54). `readShape` builds `colors` from `fill`, `stroke`, the first *non-header* row's text fill, `strokeWidth` and `dash` only; nothing in the package reads `headerFill` or a header row's fill (grep for `headerText|headerFill` in diagram-formats is empty). So the scene → document → JSON round trip (the native format, "which carries everything the model holds") comes back with the theme's header colors. Also, a node whose only text row is its header (a folded class box, or one with no fields) gets `text` from `dataOf(undefined)`, so an own text color is lost too and returns to the theme's when it is expanded.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/sceneReaders.ts
- size: function
- cause: reader omits NodeStyle fields `header`/`headerText`
- confidence: likely

## documentFromScene drops a container's or pool's own stroke width
- where: packages/diagram-formats/src/sceneReaders.ts:262 (regionColors)
- scenario: a region with `colors.strokeWidth: 3`, from the user, or from DOT's cluster `penwidth` (dot/read.ts readCluster writes `strokeWidth`), is drawn with that width (`regionSpecs.ts:63` → `outlineOf(style, 'region')` uses `style.strokeWidth`). `regionColors` compares only `fill`, `stroke` and title `text`, so on export the width is gone and the box comes back at the theme's width. The node path (`readShape`) does read `stroke.width`.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/sceneReaders.ts
- size: line
- cause: region reader omits strokeWidth
- confidence: likely

## DOT positions are all dropped when only invisible nodes lack `pos`
- where: packages/diagram-formats/src/dot/read.ts:369 (readDot) / packages/diagram-formats/src/dot/positions.ts:17 (positions)
- scenario: a hand-written neato input where every visible node has `pos="x,y!"` and a `style=invis` spacer node has none. `positions` runs over every node, invisible ones included, before they are filtered out, so one unplaced invisible node makes it return `null`: every visible position is thrown away with a "pos was dropped" warning and the page is laid out from scratch. It should judge "every node has a pos" over the nodes that are kept.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: line
- cause: placement checked before invisible filter
- confidence: sure

## DOT `inv`, `oinv` and `invempty` arrowheads read as forward arrows, with no warning
- where: packages/diagram-formats/src/dot/values.ts:134 (ARROWS)
- scenario: `a -> b [arrowhead=inv]` draws a triangle pointing back at the tail in Graphviz. The table maps it straight to `'arrow'` (and `oinv`/`invempty` to `'triangle-hollow'`), so the edge reads as pointing the other way. Unlike an unknown name, which `marker()` reports in "DOT arrowheads drawn as arrows", these go through silently.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/values.ts, packages/diagram-formats/src/dot/read.ts
- size: line
- cause: approximation mapped without warning
- confidence: likely

## laidOutPage sizes the page from boxes only, ignoring laid-out routes
- where: packages/diagram-formats/src/pageLayout.ts:86 (laidOutPage)
- scenario: a self-loop, or an edge that layout routes around the outside of the nodes, gets `routed` points past the outermost node box. The page's width, height and the top/left shift come only from node and container boxes, so the route (and its label) can fall outside the page or across its margin after import.
- evidence: read
- severity: low
- size: function
- cause: extent omits edge routes and labels
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

<!-- done: 5 findings, files read: 39 -->
