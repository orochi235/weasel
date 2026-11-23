## A drag frame's search limit takes a non-finite box unfiltered, so a failing leg doubles its window ~1000 times
- where: packages/diagram/src/avoid/dragIndex.ts:83 (DragIndex.frame)
- scenario: `limitOf` in router.ts deliberately leaves out non-finite coordinates "so the limit stays one a window can reach", but `frame` widens that limit with `unionRects([limit, o.box])` for every displaced obstacle, unfiltered. A dragged shape whose preview pose is degenerate (NaN or infinite bounds) makes `frame.limit` NaN/infinite. In `routeEdge` (edgeRoute.ts:70), `within(ctx.limit, window)` is then never true, so any leg with no path in its first window (a connector walled in near the drag) keeps doubling `grow` from `margin` until the window itself overflows: about 1017 doublings, each a full visibility-graph search over every obstacle in an ever larger window. The budget (`spent`) is only checked between connectors, so one such connector blows the 4 ms frame budget by orders of magnitude. The commit path would stop at the finite limit instead. Expected: the same finite filter `limitOf` applies, e.g. skip non-finite boxes when widening.
- evidence: read
- severity: medium

## A connector that finds no path places its label on its stale stored route during the commit, but on its fallback line afterward
- where: packages/diagram/src/avoid/router.ts:240 (routeDirty)
- scenario: when `routeEdge` returns null, `routeDirty` places the edge's label with `labelObstacle(edge, full ?? fullRoute(edge))`. `edge` still holds its old `route`, so `fullRoute` puts the label on that old route. The commit answers null for the connector, the host drops its route, and `commit` puts the label obstacle in `committed` via `labelObstacles(edges, routeOf)` on `withRoute(e, out)`, which has no route, so the label sits on the waypoints/facing-port fallback line. During the commit, every later dirty connector and the retry pass route around a label at a spot where it will never be drawn, and may go round it or fail because of it. The next update then sees the label "moved" (committed versus input) and reroutes again. Expected: place a failing edge's label on the line it falls back to, i.e. `fullRoute` of the edge with its route removed.
- evidence: read
- severity: low

## A connector label is avoided on the scene path but not on the data-backed path when its connector is split across pages
- where: packages/diagram/src/avoid/specRoutes.ts:100 (createSpecRouter) / obstaclesOf
- scenario: `avoidSceneInput` (sceneInput.ts:111-114) makes a split (`offPage`) connector's label an obstacle of its own. `createSpecRouter`, whose docs say it reads obstacles "as `avoidSceneInput` reads a scene", skips `offPage` edges (`if (edge === null || edge.offPage !== undefined) continue`), and its `labelsOf` result is used only for routed edges. The split connector's label is never an obstacle, so in a `diagramScene` built from specs, other connectors route straight through a label they would avoid in the same diagram edited live. One question, two answers.
- evidence: read
- severity: low

## An edge with no facing ports is routed null and has its route stripped on the spec path, but left alone on the scene path
- where: packages/diagram/src/avoid/specRoutes.ts:110 (createSpecRouter)
- scenario: `avoidSceneInput` drops an edge whose ends yield no ports with a normal (`if (from.length === 0 || to.length === 0) continue;`, sceneInput.ts:131), so the router never answers for it and its stored route stands. `createSpecRouter` pushes such an edge anyway. `routeEdge` returns null for it, and the returned spec gets `router: 'avoid'` with its route removed. An edge between shapes whose ports have `normal: null`, or a named port with no facing site, behaves differently in the two hosts.
- evidence: read
- severity: low

## Only an edge's first label is an obstacle; any further label of the same connector is not avoided by anyone
- where: packages/diagram/src/avoid/sceneInput.ts:91 (avoidSceneInput); packages/diagram/src/avoid/specRoutes.ts:73 (labelsOf)
- scenario: both readers keep one label per owner (`!labels.has(owner)` / `out.has(owner)`) and silently drop the rest. They do not become an `AvoidLabel`, and no `kind: 'label'` obstacle is made from them either. A connector with labels at both its start and its middle has the second one crossed freely by other connectors. Expected: every label node is an obstacle for the other connectors, even if the router stations only one per edge. If the diagram package allows only one label per edge, this does not apply.
- evidence: read
- severity: low

## A preview before any seed or commit routes against no obstacles at all
- where: packages/diagram/src/avoid/router.ts:131 (preview)
- scenario: `createAvoidRouter()` followed by `update(input, { preview: true })` builds the drag index from `committed`, which is empty. `DragIndex.frame` then skips every obstacle in the frame (`base === undefined → continue`), so the index stays empty and every dirty connector routes straight through the shapes. `AvoidRouter` is exported for hosts without scenes (index.ts), and nothing in its docs says a preview needs a prior `seed`. Expected: route a first preview against `input.obstacles`, or document that it needs a seed. `installAvoidRouting` seeds, so the scene path is unaffected.
- evidence: read
- severity: low

## A locked connector's unstored route still shapes the committed state: its label and segments sit where it is not drawn
- where: packages/diagram/src/avoid/install.ts:142 (installAvoidRouting edit pass); router.ts:173-176 (commit)
- scenario: the pass calls `router.update`, then `router.forget(locked ids)`. But `commit` has already built `committed` and the drag index from `withRoute(e, out)`, which carries the new route that `routeDataOps` refuses to store for a locked connector. Until the next edit, drag frames route other connectors around the locked connector's label at its unstored position, and find "meeting" connectors against segments the scene does not hold. `forget` clears only `keys/raw/shown/pathless`, not `committed` or `drag`.
- evidence: read
- severity: low

## Files read
packages/diagram/src/avoid/avoid.bench.ts
packages/diagram/src/avoid/avoidFixture.ts
packages/diagram/src/avoid/dirty.ts
packages/diagram/src/avoid/dragIndex.ts
packages/diagram/src/avoid/edgeRoute.ts
packages/diagram/src/avoid/grid.ts
packages/diagram/src/avoid/hash.ts
packages/diagram/src/avoid/heap.ts
packages/diagram/src/avoid/holds.ts
packages/diagram/src/avoid/index.ts
packages/diagram/src/avoid/install.ts
packages/diagram/src/avoid/labels.ts
packages/diagram/src/avoid/nudge.ts
packages/diagram/src/avoid/obstacles.ts
packages/diagram/src/avoid/router.ts
packages/diagram/src/avoid/sceneInput.ts
packages/diagram/src/avoid/scenes.fixture.ts
packages/diagram/src/avoid/search.ts
packages/diagram/src/avoid/segments.ts
packages/diagram/src/avoid/specRoutes.ts
packages/diagram/src/avoid/stateTable.ts
packages/diagram/src/avoid/turns.ts
packages/diagram/src/avoid/types.ts
packages/diagram/src/avoid/useAvoidRouting.ts
packages/diagram/src/avoid/visibility.ts

<!-- done: 7 findings, files read: 25 -->
