# Audit round 70 — diagram-formats (blind reviewer)

## documentFromScene puts edges to shapes on a plot or sequence page into crossPageEdges, though those shapes are left out of the document
- where: packages/diagram-formats/src/fromScene.ts:106-130 (documentFromScene)
- scenario: a scene has a plot root on page 1 plus a free shape `s` on that page, and a connector from `s` to a shape `t` on page 2. `s` goes into page 1's bucket and `itemPage` (line 107). Page 1 is then returned as the plot page and its bucket's nodes are discarded (line 135). The connector's ends are on different pages, so it is pushed to `crossPageEdges` (line 129). The document then holds a cross-page edge whose `from` is an id no page has. Every reader of the document gets a dangling edge: `documentSpecs` hands it to `diagramScene`, and the graph writers' `crossPageEdges` check sees it. The same happens for a shape on a sequence page (that page's bucket is also discarded at line 138). An edge whose end is left out should be dropped along with that end.
- evidence: read
- severity: medium

## DOT reader warns that root and plain-subgraph graph attributes were dropped, yet still applies them to every cluster opened after them
- where: packages/diagram-formats/src/dot/read.ts:75-78, 113 (DotReader.walk / subgraph)
- scenario: `digraph { color=red; style=filled; fillcolor=yellow; subgraph cluster_a { x } }`. `dropUnread('root', …)` lists `color`, `style` and `fillcolor` under "DOT attributes a diagram does not hold were dropped". Line 78 still stores them in `root.graph`, and `subgraph()` copies that map into `cluster_a`'s attributes (line 113). So `readCluster` draws cluster `a` red-stroked and yellow-filled. The warning says the attributes were dropped while the import applies them. A plain `subgraph { color=red; subgraph cluster_b {…} }` does the same. The warning should name only attributes nothing reads, or the inheritance should be dropped to match it.
- evidence: read
- severity: low

## DOT style words other than filled/rounded/dashed/dotted are ignored with no warning, `invis` included
- where: packages/diagram-formats/src/dot/read.ts:139-146, 196-203 (readNode, readEdge); packages/diagram-formats/src/dot/values.ts:153-163 (stylesOf, dashOf)
- scenario: `a [style=invis]; a -> b [style=invis]` is the usual Graphviz trick for a layout-only node or edge. It imports as a visible node and a visible connector, with no warning. `style=bold` (Graphviz doubles the pen width), `setlinewidth(3)` (`stylesOf` strips the argument and nothing reads the word), `diagonals`, `striped` and `wedged` are dropped silently too. An attribute the reader does not hold gets a "dropped" warning (`dropUnread`), but a style word it does not hold gets nothing. The fix is to list unread style words under that warning, or to treat `invis` as hiding the item.
- evidence: read
- severity: low

## DOT `detect` rejects headers the DOT reader accepts
- where: packages/diagram-formats/src/dot/format.ts:7-9, 35 (COMMENTS, KEYWORD, ID, hasHeader)
- scenario: each of these is read by `readDot`, but `DIAGRAM_DOT.detect` returns false for it, so `readDocument` without a forced format fails with "not a diagram file this package reads":
  - (a) `digraph "a" + "b" { }`: the lexer joins `+`-concatenated strings (lex.ts:80-92); `ID` allows one quoted string only.
  - (b) `digraph "a\` + newline + `b" { }`: in `ID`, `\\.` does not match a newline, while the lexer reads backslash-newline as a line continuation and `COMMENTS` accepts it (`\\[\s\S]`).
  - (c) `strict/*x*/digraph { }`: the comment is replaced with `''`, which leaves `strictdigraph`, and `KEYWORD` needs `strict\s+`. The lexer tokenizes it as `strict` then `digraph`.

  Replacing a comment with a space, and widening `ID` to match the lexer's quoted-string rules, would close all three.
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
