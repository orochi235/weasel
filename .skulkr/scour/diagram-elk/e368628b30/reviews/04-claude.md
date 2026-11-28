## ELK lays out every node at its bare bounds, ignoring `GraphNode.margin`
- where: packages/diagram-elk/src/toElk.ts:137 (leafOf)
- scenario: a graph whose nodes carry `margin` (DiagramNode.margin, e.g. a node whose glow or badge reaches 12 past its bounds) → `leafOf` gives ELK only `bounds.width/height` and no `elk.margins`, so `nodeGap` is measured from the bare box and neighboring nodes' margins overlap; the diagram's own layouts (`planOf`) lay the node out as that much bigger. The option is silently dropped on the ELK path.
- evidence: read (graph.ts:52-54 documents planOf's use; leafOf reads only bounds)
- severity: medium
- fix: packages/diagram-elk/src/toElk.ts
- size: line
- cause: margin not passed (`elk.margins` / enlarged box)
- confidence: likely

## A direction given in `elkOptions` by ELK's short suffix id is not seen by the label-room and minimum-size logic
- where: packages/diagram-elk/src/toElk.ts:181 (crossAxis), packages/diagram-elk/src/toElk.ts:188 (minimumTransposed), packages/diagram-elk/src/elkPlan.ts:81 (shortIds)
- scenario: `elkPlan(g, { elkOptions: { direction: 'RIGHT' } })` — ELK resolves option ids by suffix, so it lays out left-to-right, but `shortIds` only rewrites the `org.eclipse.elk.` prefix, so the root also keeps the derived `elk.direction: 'DOWN'` beside it. ELK picks one; `crossAxis` and `minimumTransposed` read only `elk.direction` and answer for DOWN: an offset label's room is widened along the wrong axis, and a cluster's `minWidth` is written transposed (or not) for the wrong direction. The same decision is answered two ways.
- evidence: read (suffix resolution in ELK is from memory of its option service)
- severity: low
- fix: packages/diagram-elk/src/elkPlan.ts
- size: function
- cause: id normalization covers only one alias form
- confidence: likely

## `elkOptions` can override the coordinate frame `fromElk` assumes
- where: packages/diagram-elk/src/elkPlan.ts:78 (elkRootOptions)
- scenario: `elkOptions: { 'elk.json.shapeCoords': 'PARENT' }` (or `edgeCoords`) is spread over the derived options; `fromElk` still reads every position as root-frame, so every node and cluster inside a cluster is placed offset by its ancestors' origin, and routes likewise. These two keys are the adapter's own contract, not a layout choice, and should be written after the caller's options.
- evidence: read
- severity: low
- fix: packages/diagram-elk/src/elkPlan.ts
- size: line
- cause: user options spread over internal invariants
- confidence: sure

## `elkPlanner(opts)` lets an explicitly undefined option erase the run's
- where: packages/diagram-elk/src/elkPlan.ts:126 (elkPlanner)
- scenario: `elkPlanner({ direction: props.direction })` with `props.direction` undefined, used by a live run passing `{ direction: 'right' }` → `{ ...layout, ...opts }` sets `direction: undefined`, so `elkRootOptions` falls back to 'down' and the run's direction is dropped. Same for `nodeGap`, `rankGap`, `pin`, `tolerance`.
- evidence: read
- severity: low
- size: line
- cause: object spread copies undefined-valued keys
- confidence: sure

## Files read
packages/diagram-elk/src/elkPlan.ts
packages/diagram-elk/src/fromElk.ts
packages/diagram-elk/src/index.ts
packages/diagram-elk/src/toElk.ts

<!-- done: 4 findings, files read: 4 -->
