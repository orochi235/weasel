# Audit round 72 — diagram-formats (reviewer findings)

## A filled DOT cluster with no fillcolor, color or bgcolor reads with no fill, where Graphviz fills it lightgrey
- where: packages/diagram-formats/src/dot/read.ts:292 (readCluster)
- scenario: `digraph { subgraph cluster_a { style=filled; a } }` → the container gets no `fill` (falls to `bg`, undefined, then `{}`), so it draws in the theme's container fill; Graphviz draws the cluster lightgrey (its cluster fillcolor default). `readNode`/`nodeColors` answers the same question with `unsetFill` `'lightgrey'` (read.ts:159, 185), so the two box kinds read `style=filled` two ways.
- evidence: read
- severity: medium

## A reopened subgraph or cluster forgets the node and edge defaults its earlier opening set
- where: packages/diagram-formats/src/dot/read.ts:148-152 (DotReader.subgraph)
- scenario: `digraph { subgraph cluster_a { node [shape=box]; x } subgraph cluster_a { y } }` — Graphviz keeps a named subgraph's default dictionaries on the subgraph object, so `y` is a box; here the second opening's scope starts from `new Map(parent.node)` / `new Map(parent.edge)` and `y` is an ellipse. Only the cluster's `graph` map is kept in `this.clusters`; a named non-cluster subgraph loses even its graph attributes (`new Map(parent.graph)`), e.g. a `cluster=true` or `label` it set the first time.
- evidence: read
- severity: low

## Graph attributes a nested cluster inherits are warned as dropped where they are set
- where: packages/diagram-formats/src/dot/read.ts:101 (DotReader.walk → dropUnread(scope.kind, …))
- scenario: `digraph { color=red; style=filled; subgraph cluster_a { a } }` or `subgraph { label="L"; subgraph cluster_b { b } }` — `READ.root`/`READ.plain` do not list `color`, `style`, `label` (plain), so the import warns "DOT attributes a diagram does not hold were dropped: color, style", yet the value is copied into every cluster below (`clusterGraph(parent.graph)`) and read there as the cluster's stroke/fill/label. The warning tells the user something was lost that was kept.
- evidence: read
- severity: low

## DOT writer never resets an inherited `penwidth`, so a nested box with no stroke width of its own reads back with its parent's
- where: packages/diagram-formats/src/dot/write.ts:66-95 (Inherited / writeCluster)
- scenario: container A with `colors.strokeWidth: 4` holding container B (theme style, `strokeWidth` unset) or a group (`style` undefined): A writes `penwidth=4;`, B writes nothing for penwidth, and `readDot` copies A's graph attributes into B (`clusterGraph`), so B comes back with `strokeWidth: 4`. `Inherited` tracks label, style, color and fontcolor but not penwidth (nor `fillcolor` for a child that turns `filled` back on without its own fill is fine, but penwidth has no reset at all).
- evidence: read
- severity: low

## DOT `width`/`height` of zero or below are read as the node's size, where Graphviz holds them to its 0.01in minimum
- where: packages/diagram-formats/src/dot/read.ts:186-195 (readNode, via numberAttr)
- scenario: `digraph { a [width=-1, height=0] }` → `numberAttr` accepts any finite number, so the node gets `width: -72, height: 0` and draws as a degenerate/inverted box (and `positions` computes a negative extent for it); Graphviz clamps both to 0.01in (and grows the node to its label unless `fixedsize`). Should clamp, or drop with the "not numbers" style of warning.
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

<!-- done: 5 findings, files read: 38 -->
