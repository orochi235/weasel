# Audit round 72 — diagram-formats — blind reviewer findings

## DOT writer does not reset an outer cluster's `penwidth` in a nested cluster, so the inner one reads back with the outer's stroke width
- where: packages/diagram-formats/src/dot/write.ts:66 (`Inherited`), :88-94 (`writeCluster`)
- scenario: container `outer` with `colors.strokeWidth: 3` holding container `inner` with no stroke width of its own. `writeCluster` writes `penwidth=3;` in `subgraph cluster_outer`, and nothing about `penwidth` in the nested `subgraph cluster_inner`. `Inherited` tracks `label`, `styled`, `stroke` and `text` (each reset with `label=""`, `style=""`, `color=""`, `fontcolor=""`) but has no `strokeWidth` field. The reader copies the parent cluster's graph attributes into the child (`read.ts` `subgraph` → `clusterGraph(parent.graph)`), and `readCluster` reads `penwidth` from them, so `inner` comes back with `strokeWidth: 3` it never had. Graphviz draws it the same way: inner clusters inherit graph attributes. It should either write `penwidth` explicitly, as it does for the other inherited fields, or track it in `Inherited`.
- evidence: read
- severity: medium

## DOT reader warns that root and plain-subgraph graph attributes were "dropped" while it still applies them to every cluster below
- where: packages/diagram-formats/src/dot/read.ts:22-24 (`READ.root`, `READ.plain`), :99-102 (`walk`), :135-138 (`clusterGraph`)
- scenario: `digraph { graph [style=filled, fillcolor=yellow, penwidth=2]; subgraph cluster_a { a } }`. `walk` calls `dropUnread('root', …)`, which lists `style`, `fillcolor` and `penwidth` under "DOT attributes a diagram does not hold were dropped". It then stores them in `root.graph` anyway, `clusterGraph` copies them into `cluster_a`, and `readCluster` draws `a`'s container filled yellow with stroke width 2. The same thing happens for `subgraph s { color=red; subgraph cluster_x { … } }` in a plain scope: `color` is warned about but reaches `cluster_x`. The warning names attributes that were not dropped. It should warn only about keys that no scope below reads (only `bgcolor` really is removed at the root).
- evidence: read
- severity: low

## DOT reader gives a filled cluster with no color no fill, while a filled node with no color gets Graphviz's lightgrey
- where: packages/diagram-formats/src/dot/read.ts:286-292 (`readCluster`) vs :159, :185 (`nodeColors` / `readNode`)
- scenario: `subgraph cluster_a { style=filled; a }` with no `fillcolor`, `color` or `bgcolor`. `readCluster` computes `fill = fillcolor ?? color ?? bg`, which is `undefined`, so the container has no `fill` and draws in the theme's container fill. Graphviz fills a filled cluster with no color with its default fill, lightgrey (inference from Graphviz's `DEFAULT_FILL`; not run). `readNode` answers the same question for nodes with `unsetFill = 'lightgrey'`, so the reader answers "filled with nothing named" two different ways.
- evidence: read (the Graphviz default is inference)
- severity: low

## Diagram JSON reader validates a v1 page's `groups` list not at all, then renames it to `clusters` unchecked
- where: packages/diagram-formats/src/jsonFormat.ts:43-46 (`pageProblem`), :79-82 / :101-103 (`read`, `upgradeV1Page`)
- scenario: a version 1 document whose graph page holds `"groups": [{ "members": [] }]` (no id) or `"groups": 5`. `pageProblem` checks only `clusters` and `containers`, which a v1 page does not use under those names, so validation passes. `upgradeV1Page` then renames `groups` to `clusters`, and the document reaches callers with a `clusters` value that a v2 file holding the same thing would have been refused for ("whose clusters is not a list of items with string ids"). Later readers (`graphOut`'s `clusterTree` iterates `g.members`, `toScene`) then throw or misbehave on it. The same list gets checked or not depending on the file's version. It should validate after the upgrade, or check `groups` for v1.
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
