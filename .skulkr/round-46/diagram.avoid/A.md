# Audit round 46 — diagram.avoid (blind reviewer)

Note: the checkout is at 782733b19c, not the stated 6438325dbf (that object is absent from this repo). Lines cite 782733b19c.

## Crossing another route at a visibility-graph vertex costs nothing, so `crossPenalty` is dropped for the commonest crossings
- where: packages/diagram/src/avoid/segments.ts:67 and :72 (SegmentIndex.crossings), as called per step from packages/diagram/src/avoid/search.ts:143 (stepCost)
- scenario: the search prices each step between two adjacent graph vertices on its own, and `crossings` counts a perpendicular segment only when it lies strictly inside the step (`s.x0 > lx + EPS && s.x0 < hx - EPS`). Routes run along the graph's lines: the inflated corners of the same obstacles cast the same lines in every search whose window holds them. When another connector's vertical run lies on such a line x = c, the current search has a vertex at (c, y) wherever its row meets that line, so a horizontal pass across it is split into a step ending at x = c and a step starting at x = c, and neither counts the crossing. Example: another route on x = 50 from y = −100 to 100, and an obstacle whose inflated corner sits at x = 50 (box x 60, clearance 10). A leg from (0,0) east to (100,0) is priced 100 and not 120, the same as when no route is there. Crossings are uncounted exactly where routes share lines, which is where crossing minimization matters. A crossing should be counted once per step pair, e.g. counting an endpoint touch on one side only (`>= lx` / `< hx`).
- evidence: read
- severity: medium

## After undo or redo the router keeps the undone edit's obstacles and labels, because nothing reseeds it
- where: packages/diagram/src/avoid/install.ts:133-140 (installAvoidRouting)
- scenario: the router keeps its committed state up to date only from the edit pass, and `addEditPass` says that "undo, redo, and history replays never run it" (core/scene/editPass.ts:42). Drag shape A from P to Q, which commits: the router's `committed` holds A at Q and the labels where the Q routes put them. Undo puts A and the routes back at P. Two bad results follow. (1) Start a drag of another shape. `preview` routes against `drag`, built from the stale commit: the label obstacles stand where the undone routes put them, and preview never recomputes labels, so connectors route around phantom labels and through the real ones. (2) The next live edit, even an unrelated one such as recoloring a node, sees A as a changed obstacle and every key as stale. It reroutes A's connectors and those near P and Q, and writes those routes into the unrelated edit's undo entry. The routing should reseed from the scene after a history step (e.g. on a history listener, or when an edit finds `committed` differing from what it last wrote).
- evidence: read
- severity: medium

## A cancelled drag's previews come back as routes in a later drag that runs out of budget
- where: packages/diagram/src/avoid/router.ts:116-119 (preview), and :133 (only `commit` clears `previews`)
- scenario: `previews` is cleared only by a commit. A drag cancelled with Escape writes nothing, so no commit runs and every route it previewed stays in the map. In a later drag, a dirty connector the 4 ms frame budget (install's default) does not reach gets `previews.get(id)`: a route from the cancelled drag, made for shapes at positions they no longer hold. It is returned as that connector's preview and drawn. The routes kept past the budget should come from the current drag only, e.g. by clearing `previews` when a preview finds no displaced obstacle, or by stamping each preview with its drag.
- evidence: read
- severity: medium

## The follower's sub-pixel "still" shortcut answers the last drag's previews on a new drag's first frame
- where: packages/diagram/src/avoid/install.ts:89-104 (avoidFollower, `still` and `last`)
- scenario: `last` is never reset when a drag ends. Drag A to Q and release, which commits nudged routes. Then edit a connector of A (restyle it, or move one of its waypoints) and start dragging A again. The first frame puts A within a pixel of Q, so `still(frame)` is true and `last.out` is returned: unnudged preview routes from the previous drag, carrying `withRoute(shown, …)` built on that drag's copy of the connector's data. For that frame the connector shows its old data and an old route. `last` should be dropped when a drag finishes, or the shortcut should also compare the scene revision or data it was built from.
- evidence: read
- severity: low

## The spec router and the scene reader route self-loops and split connectors' labels differently
- where: packages/diagram/src/avoid/specRoutes.ts:96 (createSpecRouter, `a === b`) and :93 / obstaclesOf (no split-label obstacles), against packages/diagram/src/avoid/sceneInput.ts:109-112 and :119
- scenario: `avoidSceneInput` routes a self-loop whose ends both name a port, and turns an off-page (split) connector's label into a `label` obstacle. `createSpecRouter` skips every edge whose two ends are one spec, so a data-backed self-loop with `from.port` and `to.port` never gets a route or `router: 'avoid'`. It also skips split connectors without filing their labels, so routes in a data-backed diagram run through a split connector's label, which the same diagram as a live scene routes around. Its doc says it reads specs "as `avoidSceneInput` reads a scene".
- evidence: read
- severity: low

## A moved label is matched against routes by `clearance`, though it is inflated by `labelClearance`
- where: packages/diagram/src/avoid/dirty.ts:103 (dirtyEdges); likewise packages/diagram/src/avoid/dragIndex.ts:82-83 (frame)
- scenario: changed boxes are grown by `clearance` to find the routes they meet, but `ObstacleIndex` inflates a label by `labelClearance`. With `labelClearance > clearance`, say clearance 4 and labelClearance 12, a label that moves to 8 units from another connector's run does not dirty it. That route then sits inside the label's clearance until something else reroutes it. The growth should be per obstacle kind, as `ObstacleIndex.file` does.
- evidence: read
- severity: low

## Routes computed for locked connectors are recorded as held, so after unlock the connector is never rerouted
- where: packages/diagram/src/avoid/install.ts:55 (routeDataOps skips locked) with packages/diagram/src/avoid/router.ts:145 (keys set for every dirty edge)
- scenario: a shape moves across a locked connector. The router reroutes it and stores the new `keys`, `raw` and `shown`, but `routeDataOps` writes nothing, so the scene keeps the old route through the shape. After unlock, nothing in `dirtyEdges` fires (keys match, no changed obstacle), so the connector keeps running through the shape until a later edit happens to touch it. The router's state for an edge whose write was refused should be dropped so the next update reroutes it.
- evidence: read
- severity: low

## The routeEdge window-doubling loop never ends when the limit is not finite
- where: packages/diagram/src/avoid/edgeRoute.ts:61-67 (routeEdge), with router.ts:45-66 (limitOf)
- scenario: `limitOf` folds every obstacle box and port through `Math.min`/`Math.max`, so a single NaN coordinate (a degenerate pose, which visibility.ts:70 already guards against) makes the limit NaN. With an Infinity size, `limit.x + limit.width` becomes NaN once the window grows to infinity. `within(ctx.limit, window)` is then never true. Any leg whose search answers null (no path, not sealed) keeps doubling `grow` to Infinity and then loops forever, and the edit pass hangs the tab. The loop needs a bound, or the limit needs a finiteness check.
- evidence: read
- severity: low

## nearEdges picks an index past the end of `shapes` when the last shape starts a row
- where: packages/diagram/src/avoid/avoidFixture.ts:78 (nearEdges)
- scenario: the fallback `j = i % cols === 0 ? i + 1 : i - 1` gives `j = shapes.length` when `i` is the last shape and starts its own row. That happens for shape counts n = c(c−1)+1, e.g. 7 (cols 3, i = 6). Here `j >= shapes.length` is hit with probability about 2/3, `shapes[j]` is undefined, and `edgeBetween` throws on `b.id`. The bench's 200 shapes avoid it by chance, but any other count of that form crashes the fixture.
- evidence: read
- severity: low

## The full-route bench reports only the last run's unrouted count
- where: packages/diagram/src/avoid/avoid.bench.ts:100 (fullRoute)
- scenario: `failed` is reassigned on each of the three layouts, so the printed "unrouted" is run 3's count, while the times beside it are the median and max of all three. Connectors left unrouted by layouts 3 and 4 go unreported. It should be summed, or reported as the max.
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

<!-- done: 10 findings, files read: 25 -->
