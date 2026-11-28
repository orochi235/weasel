# diagram-elk findings

## Authored edges go to ELK as ordinary edges, so ELK keeps rank room and label room for them, unlike `layered`
- where: packages/diagram-elk/src/toElk.ts:106 (toElk, `elkEdges` map)
- scenario: a graph with an `authored: true` edge spanning several ranks and carrying a `label`. `GraphEdge.authored` says layout "keeps no room for it in the ranks it crosses", and `layered` honors that (`layered/expand.ts:60` skips its label row, `:182` gives it no dummy chain). `toElk` sends it to ELK like any other edge, with a label of `labelRoom` size, so ELK inserts long-edge dummies and a label slot for it and spreads neighbors apart for a route `planFrom` then throws away (`edge.authored` → `continue`). The same graph lays out tighter under `layered` than under ELK for no reason the caller asked for.
- evidence: read
- severity: medium
- fix: packages/diagram-elk/src/toElk.ts
- size: function
- cause: `authored` honored only when reading ELK's answer back, not when building its input
- confidence: sure

## `nodeGap`, `rankGap` and the node-placement strategy are set on the root only, so inside a cluster ELK uses its own defaults
- where: packages/diagram-elk/src/toElk.ts:162 (clusterOptions); packages/diagram-elk/src/elkPlan.ts:64 (elkRootOptions)
- scenario: `elkPlan(graph, { nodeGap: 80, rankGap: 150 })` on a graph whose nodes sit in a cluster. ELK does not pass layout options down from parent to child: with `INCLUDE_CHILDREN`, layered builds each compound node's nested graph from that node's own properties. Each cluster's options hold only `elk.padding` and the minimum size, so nodes inside a cluster are spaced by ELK's defaults (20 / 20), and placed by Brandes–Köpf, which the root comment says can push a chain past the outermost node. Top-level nodes follow `nodeGap`/`rankGap`. The caller's gaps are dropped wherever clusters are used.
- evidence: read (the package's tests check `rankGap` only on an unclustered graph, `elkPlan.test.ts:85`); ELK's lack of inheritance is from my knowledge of ELK, not run here
- severity: medium
- fix: packages/diagram-elk/src/toElk.ts, packages/diagram-elk/src/elkPlan.ts
- size: function
- cause: options derived for the root not repeated on compound nodes
- confidence: likely

## `minimumTransposed` swaps a cluster's minimum width for any algorithm, not only `layered`
- where: packages/diagram-elk/src/toElk.ts:192 (minimumTransposed)
- scenario: `elkPlan(graph, { elkOptions: { 'elk.algorithm': 'mrtree' } })` (or `force`, `rectpacking`) with a cluster that has `minWidth: 300` and children. Direction defaults to `DOWN` and `hierarchyHandling` to `INCLUDE_CHILDREN`, so `minimumTransposed` answers true and writes `(0, 300)`. The swap compensates for layered's transposed handling of compound nodes with vertical ranks; another algorithm reads the pair as written, so the cluster gets a minimum *height* of 300 and no minimum width.
- evidence: read (the docstring scopes the swap to layered's laying out every level at once); behavior of other algorithms inferred
- severity: low
- fix: packages/diagram-elk/src/toElk.ts
- size: line
- cause: transposition check ignores `elk.algorithm`
- confidence: likely

## Files read
packages/diagram-elk/src/elkPlan.ts
packages/diagram-elk/src/fromElk.ts
packages/diagram-elk/src/index.ts
packages/diagram-elk/src/toElk.ts

<!-- done: 3 findings, files read: 4 -->
