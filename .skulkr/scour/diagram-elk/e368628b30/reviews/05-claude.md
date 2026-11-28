# diagram-elk findings

## A bare-suffix ELK option id in `elkOptions` sits beside the derived `elk.` one, and the adapter reads the wrong value
- where: packages/diagram-elk/src/elkPlan.ts:82 (shortIds)
- scenario: `elkPlan(graph, { elkOptions: { direction: 'RIGHT' } })` (ELK resolves option ids by suffix, so `direction`, `algorithm`, `hierarchyHandling` are accepted ids). `shortIds` only rewrites the `org.eclipse.elk.` prefix, so the root options hold both `elk.direction: 'DOWN'` (derived) and `direction: 'RIGHT'`. ELK applies both in insertion order and lays out RIGHT, but `crossAxis` and `minimumTransposed` (toElk.ts:187, 195) read only `elk.direction`/`org.eclipse.elk.direction` and see DOWN: an offset label's room is widened along width instead of height, and a cluster's `minWidth` is sent transposed `(0, w)` under a RIGHT layout, so ELK reserves the title width as height. Should normalize every id ELK would accept to one key (or reject unknown short forms) before deriving.
- evidence: read
- severity: low
- fix: packages/diagram-elk/src/elkPlan.ts, packages/diagram-elk/src/toElk.ts
- size: function
- cause: option-id normalization covers one alias form only
- confidence: likely

## Direction compared case-sensitively where ELK parses enums case-insensitively
- where: packages/diagram-elk/src/toElk.ts:187 (crossAxis), packages/diagram-elk/src/toElk.ts:195 (minimumTransposed)
- scenario: `elkOptions: { 'elk.direction': 'right' }`. ELK's enum option parsing upper-cases the value and lays the graph out RIGHT, but `crossAxis` compares `=== 'RIGHT'` and answers `'width'`, and `minimumTransposed` compares `=== 'DOWN' || 'UP'` (and `'INCLUDE_CHILDREN'`), so label rooms and cluster minimums take the axis for the wrong direction. Should compare upper-cased values.
- evidence: read
- severity: low
- size: line
- cause: exact-string enum comparison
- confidence: likely

## `elkOptions` can override the coordinate-frame options `fromElk` depends on
- where: packages/diagram-elk/src/elkPlan.ts:75 (elkRootOptions)
- scenario: `elkOptions: { 'elk.json.shapeCoords': 'PARENT' }` (or `edgeCoords: 'CONTAINER'`) is spread over the derived `elk.json.shapeCoords: 'ROOT'`. `fromElk` (fromElk.ts:1–4) reads every child's x/y and every section as root coordinates, so every node inside a cluster lands offset by its cluster's position and routes come back in container frames; moves and routes are wrong with no error. The frame options are invariants of the adapter and should be applied after the caller's options (or the caller's value rejected).
- evidence: read
- severity: low
- size: line
- cause: caller options spread over internal invariants
- confidence: sure

## `elkPlanner` silently drops the run's `order`, so a live re-layout does not keep the seeded order
- where: packages/diagram-elk/src/elkPlan.ts:119 (elkPlanner)
- scenario: `LayoutOptions.order` defaults to `'seeded'`: keep nodes in the order they already sit in. `DiagramView.layout` / a live run passing layout options to `elkPlanner().plan` gets ELK's crossing minimization from scratch on every run (no `elk.layered.crossingMinimization.semiInteractive`, `considerModelOrder`, or position hints derived), so a second run after a user rearranged a rank can reorder it, and neither `'seeded'` nor `'barycenter'` changes anything. `ElkLayoutOptions` omits `order` from its own type, but `ElkPlanner.plan` still takes `LayoutOptions` with it and ignores it without saying so.
- evidence: read
- severity: low
- size: function
- cause: layout option with no ELK mapping, dropped on the planner path
- confidence: likely

## Files read
packages/diagram-elk/src/elkPlan.ts
packages/diagram-elk/src/fromElk.ts
packages/diagram-elk/src/index.ts
packages/diagram-elk/src/toElk.ts

<!-- done: 4 findings, files read: 4 -->
