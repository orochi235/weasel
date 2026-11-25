# Audit round 77, area `diagram.avoid`: blind reviewer findings

## A commit re-nudges a clean connector apart from its old channel mates, so it can land on one of them
- where: packages/diagram/src/avoid/router.ts:255 (bundleOf), with commit's nudge call
- scenario: three clean connectors M, P and Q share one channel and were spread by an earlier commit to c−8, c and c+8. A later edit reroutes F, whose new route touches M (a crossing elsewhere is enough) but not P or Q. `bundleOf` adds only the clean routes that the fresh routes meet. It does not add the mates of those routes, so M enters the nudge from its raw route at c, without P and Q. M is alone on that line, so its run is not spread, and it comes back at c, on top of P's run. P and Q are not rerouted. Expected: M keeps a spread position apart from P and Q (either the bundle takes in M's channel mates, or M keeps its shown route).
- evidence: read (traced through bundleOf, nudge/bundlesOf and the `raw`/`shown` bookkeeping in commit)
- severity: medium

## The drag-frame limit drops the margin that the commit-time limit keeps
- where: packages/diagram/src/avoid/dragIndex.ts:85 (DragIndex.frame)
- scenario: `limitOf` in router.ts pads the scene bounds by `2 * margin`. During a drag, `frame` unions the moved shape's bare box into the limit, with no padding. A shape dragged past the committed scene's edge leaves no room inside the limit to route around its far side. `routeEdge` stops growing the window once the window contains the limit, so a leg that needs that room returns null and the preview falls back. The commit, using `limitOf`, then routes the same connector. The two paths give different answers on how far a window may grow.
- evidence: read
- severity: low

## SpatialHash.remove leaves empty cell lists, and walking every cell visits them
- where: packages/diagram/src/avoid/hash.ts:77 (SpatialHash.remove)
- scenario: during a drag, `DragIndex.frame` calls `ObstacleIndex.replace` each frame, which removes and re-inserts the moved obstacle. Each removal leaves an empty array in `cells` for every cell the shape has left, so the map grows with the area dragged over until the next commit rebuilds the index. A query too wide to walk cell by cell (`!walkable`) iterates `cells.values()`, which includes all of those dead lists. Expected: delete a list from the map once it is empty.
- evidence: read
- severity: low

## createSpecRouter routes an edge with more than two `dependsOn`; avoidSceneInput skips it
- where: packages/diagram/src/avoid/specRoutes.ts:109 (createSpecRouter); compare sceneInput.ts:119
- scenario: an edge spec whose `dependsOn` lists three ids is routed between the first two by `createSpecRouter`. The same edge in a live scene is dropped by `avoidSceneInput` (`ends.length !== 2`). The doc comment says the spec path reads specs "as `avoidSceneInput` reads a scene", but the two disagree on which edges are routed.
- evidence: read
- severity: low

## The same box-equality and facing-port filters are defined twice
- where: packages/diagram/src/avoid/dirty.ts:11 and dragIndex.ts:15 (`sameBox`); sceneInput.ts (`facingPorts`) and specRoutes.ts (`facing`)
- scenario: each pair answers one question (are two boxes the same, which ports face a direction) in two places. The copies match today, but a change to one, such as an epsilon or a zero-normal rule, would make the commit path and the drag path, or the scene path and the spec path, disagree.
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

<!-- done: 5 findings, files read: 25 -->
