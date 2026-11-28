## DOT reader keeps a raw line break inside a quoted label as part of one line, where Graphviz breaks the line there
- where: packages/diagram-formats/src/dot/values.ts:37 (labelLines)
- scenario: `a [label="first
second"]` (a literal newline inside the quoted string, not the `\n` escape). Graphviz's `make_simple_label` ends a line at a raw newline just as it does at the `\n` escape, so it draws two lines. `labelLines` starts a new line only on the `\n`, `\l` or `\r` escapes, so the node reads as `lines: ['first\nsecond']`: one line with a newline character inside it. Edge labels and the page name go through the same function. It should start a new line at a raw newline, dropping any `\r` before it.
- evidence: read
- severity: low
- size: line
- cause: raw newline not treated as a line end
- confidence: likely

## DOT reader reads `circle`, `doublecircle` and `square` at whatever width and height they give, where Graphviz always draws them regular
- where: packages/diagram-formats/src/dot/read.ts:219 (readNode)
- scenario: `a [shape=circle, width=1, height=0.5]`. Graphviz treats circle, doublecircle and square as regular shapes, so it draws a 1in circle: the larger of the sizes the user set, or with none set, a circle sized to the label. The reader maps `circle` to `ellipse` and keeps 72x36, so the import draws a flat ellipse. `square` becomes a 72x36 rectangle the same way. A node with neither size set is left to the diagram's own sizing, which does not keep it round. The reader should make width equal height for these shapes, as it already does for `point`.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts, packages/diagram-formats/src/dot/values.ts
- size: function
- cause: regular shapes not given equal width and height
- confidence: likely

## DOT writer writes `doubleEllipse` as `shape=doublecircle`, which Graphviz draws as a circle
- where: packages/diagram-formats/src/dot/values.ts:111 (SHAPE_NAMES, used through shapeOf in dot/write.ts nodeAttrs)
- scenario: a node `{ outline: 'doubleEllipse', width: 160, height: 60 }` is written as `shape=doublecircle, width=2.2222, height=0.8333`. Graphviz draws `doublecircle` as a regular shape, so it renders a double circle 160pt across instead of a 160x60 double ellipse. No warning is given. `shape=ellipse, peripheries=2` draws what the diagram holds, and the reader would then need to map it back to `doubleEllipse`.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/values.ts, packages/diagram-formats/src/dot/read.ts
- size: function
- cause: Graphviz treats doublecircle as a regular shape
- confidence: likely

## DOT reader silently ignores `style=bold` and `style="setlinewidth(n)"`, so the line is drawn at the default width with no warning
- where: packages/diagram-formats/src/dot/values.ts:155 (stylesOf), whose words dot/read.ts nodeColors, readEdge and readCluster read
- scenario: `a -> b [style=bold]` or `a [style="setlinewidth(4)"]`. Graphviz draws `bold` at penwidth 2 and `setlinewidth(4)` at 4. `stylesOf` cuts the `(4)` off, and nothing reads `bold` or `setlinewidth`, so the edge or node gets no `width` or `strokeWidth` and draws at the theme's width. Every other attribute the reader cannot hold gets a warning, but this one gets none. It should read these words as a stroke width when `penwidth` is unset, or at least warn.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: function
- cause: style words that carry a width are dropped
- confidence: likely

## DOT reader draws no arrowhead for an edge whose `dir` value it does not recognize, where Graphviz falls back to the default direction
- where: packages/diagram-formats/src/dot/read.ts:252 (readEdge)
- scenario: `digraph { a -> b [dir=Forward] }`, or any misspelled `dir`. Graphviz's `arrow_flags` sets the default first (forward in a digraph) and overrides it only when `dir` exactly matches one of its four values, so it still draws an arrow at `b`. The reader takes any non-empty `dir` as given. `'Forward'` matches none of `forward`, `both` or `back`, so `end` and `start` are both `null`. The edge reads as `markerEnd: null`, with no arrow and no warning. A value that is not one of the four should fall back to the graph's default.
- evidence: read
- severity: low
- size: line
- cause: an unrecognized `dir` is not replaced by the default
- confidence: likely

## DOT reader drops the color `invis` with a warning, where Graphviz draws it as transparent
- where: packages/diagram-formats/src/dot/values.ts:89 (dotColor)
- scenario: `a [color=invis]`, or a cluster with `pencolor=invis`. Graphviz treats `invis` like `transparent` and `none`. `dotColor` maps only `none` to `transparent`. `invis` goes to `x11Color`, comes back unchanged as `invis`, fails `checkedColor`, and is dropped with "DOT colors a diagram cannot draw were dropped: invis". The node then draws with the theme's stroke instead of no stroke.
- evidence: read
- severity: low
- size: line
- cause: `invis` not mapped to transparent
- confidence: likely

## A cross-page edge's world-space waypoints come back in the wrong place when the source scene's page run is not laid out in the default row
- where: packages/diagram-formats/src/toScene.ts:57 (graphSpecs)
- scenario: a scene's page run is laid out with `direction: 'column'`, or a non-default `gap` or `origin`. It has an edge from page 1 to a node on the pasteboard below page 1, and that node exports to page 2. `documentFromScene` writes the edge into `crossPageEdges` with its waypoints and label point in that scene's world coordinates (`read({ x: 0, y: 0 })`, fromScene.ts:130). The document does not record the page layout. On reopen, `documentSpecs` places the pages with `layoutPages(pageList)`'s default (a row, 40 apart) and adds `crossPageEdges` without shifting them. Page 2 now sits to the right of page 1 instead of below it, but the edge's bends keep their old world points, so the route runs through the empty space where page 2 used to be. The fix is to store such an edge's points relative to a page (the page of its `from` end), or to carry the page layout in the document.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/toScene.ts, packages/diagram-formats/src/document.ts
- size: design
- cause: world coordinates tied to the source scene's page layout
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

<!-- done: 7 findings, files read: 39 -->