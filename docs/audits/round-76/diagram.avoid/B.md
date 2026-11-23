# Audit round 76 — diagram.avoid findings

## A drag frame's stored (parent-local) pose is read as a world pose
- where: packages/diagram/src/avoid/sceneInput.ts:69 (avoidSceneInput, `pose`), called from packages/diagram/src/avoid/install.ts:114 (avoidFollower.preview)
- scenario: `TransformFollower.preview`'s `frame` holds "the stored pose the frame puts each transformed node in" (core transformFinish.ts:28–31), i.e. the node's own stored pose, which for a shape inside a container is relative to its parent. `pose()` returns `poseOf(id) ?? stored(id)`, where `stored` is `worldPoses(sc, 'document')`, so a dragged child of a container at (500, 300) gets its obstacle box and ports at its local coordinates rather than world: every preview frame routes its connectors to the wrong place, and the routes snap on commit.
- evidence: read (core's doc comment on `preview`); that the frame pose is parent-local for nested nodes is inference from "stored pose"
- severity: medium

## Descendants of a dragged container keep their old world poses in a preview frame
- where: packages/diagram/src/avoid/sceneInput.ts:66–73 (avoidSceneInput, `pose`)
- scenario: dragging a container (or pool) puts only the container's id in `frame`; its children have no `poseOf` entry, so `pose()` falls back to `worldPoses` of the committed document. The region obstacle moves while the shapes inside it, and the ports of connectors on them, stay where they were, so preview routes run to the children's old positions until commit.
- evidence: read; inference that a container drag's frame lists only the transformed node
- severity: medium

## A locked connector is rerouted on every edit, and its unstored route steers the others
- where: packages/diagram/src/avoid/install.ts:142–145 (installAvoidRouting edit pass) with packages/diagram/src/avoid/router.ts:166–180 (commit)
- scenario: after `router.update`, the pass calls `router.forget` for locked ids, deleting their `keys`. On the next edit `dirtyEdges` sees `keys.get(id) !== stopsKey(e)` and marks the locked connector dirty again — on every edit while it stays locked, not "once unlocked". Each time, `routeDirty` adds its fresh (never stored) route to the crossings index, moves its label obstacle onto that route, `bundleOf`/`nudge` spread clean mates away from it, and commit's `labelObstacles(edges, routeOf)` uses `withRoute(e, out)` so the committed label sits on the phantom route. The next update then computes that label from the held route (`shown` was forgotten → `fullRoute`), sees it as a changed obstacle, and dirties whatever meets it. Other connectors are routed and nudged around a route and label that are not in the scene.
- evidence: read
- severity: medium

## A drag frame with a non-finite box makes each search double its window ~1000 times
- where: packages/diagram/src/avoid/dragIndex.ts:83 (DragIndex.frame, `limit = unionRects([limit, o.box])`)
- scenario: `limitOf` deliberately leaves out non-finite coordinates ("a degenerate pose's") so a window can reach the limit, but `frame` unions each displaced obstacle's raw box into the limit. A dragged shape whose box is NaN/Infinity (degenerate pose) gives a non-finite limit; in `routeEdge` `within(limit, window)` never holds, so a leg that finds no path grows its window from `margin` by doubling until `finiteBox(window)` fails (~1000 rounds), each a full search over every obstacle near an ever larger window. The budget check in `previewFrame` runs only between connectors, so one connector can blow far past `frameBudgetMs`.
- evidence: read
- severity: low

## Spec routing and scene routing disagree on a connector whose end offers no facing port
- where: packages/diagram/src/avoid/specRoutes.ts:105–113 (createSpecRouter) vs packages/diagram/src/avoid/sceneInput.ts:125 (avoidSceneInput)
- scenario: an end with no port carrying a normal (or a named port with none) gives `portsAt` an empty list. `avoidSceneInput` drops that connector (`if (from.length === 0 || to.length === 0) continue`), so it is never routed; `createSpecRouter` pushes it anyway, `routeEdge` answers null, and it is marked pathless forever. The same diagram thus treats the connector as "not avoid-routed" on a scene and "routed, no path" from specs — one question answered two ways.
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
