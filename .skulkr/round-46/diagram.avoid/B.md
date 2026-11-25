<!-- done: 9 findings, files read: 25 -->

I couldn't write `.skulk/out/findings.md` because permission was denied. As the brief allows, the whole document is below.

```markdown
# Audit round 46 — `diagram.avoid` (blind reviewer)

Note: the brief names commit 6438325, but that object is not in this clone. HEAD is 782733b19c, and
`packages/diagram/src/avoid` has no local changes. Line numbers refer to the working tree.

## A pathless connector's fallback line leaves out its waypoints, so its label obstacle and its dirty check are wrong
- where: packages/diagram/src/avoid/dirty.ts:79-84 (fullRoute); used at router.ts:202 (routeDirty) and in dirtyEdges via routeOf
- scenario: a labeled connector with waypoints whose last commit found no path, so it holds no `route` and is in
  `pathless`. `fullRoute(edge)` returns `[fromPort, toPort]`, a straight line between the ports that skips every
  waypoint. That line is where `labelObstacle` puts the label obstacle (router.ts:202, and labelObstacles via
  routeOf). It is also what `dirtyEdges` tests a moved obstacle against, and per the 2026-11-10 ruling that test is
  the only thing that reroutes a pathless connector. The connector is actually drawn through its waypoints by the
  fallback router. So other connectors route around a label that isn't drawn there, and an obstacle that moves onto
  the drawn path never dirties the connector. The port choice also differs from what `edge.ts:85` draws:
  `edgeEnds` aims at `route[0] ?? waypoints[0] ?? other center`, while `fullRoute` aims at
  `route[0] ?? centroid(other ports)`. The comment says "as the edge draws it", and it does not.
- evidence: read
- severity: medium

## The spec router routes connectors straight through cluster boxes that the scene router routes around
- where: packages/diagram/src/avoid/specRoutes.ts:42 (obstaclesOf)
- scenario: a cluster `C` holds `a` and `b`. An edge `x→y` between two outside nodes runs straight across `C`'s box.
  `diagramScene` builds `C` as `{ diagram: { outline: 'rect', cluster: {…} }, derivePose: CLUSTER_DERIVE_POSE }`
  (dataClusters.ts:150-172). `dataKeyReader` returns that trait, so `avoidSceneInput` files `C` as a `region`
  (sceneInput.ts:97-106), and `installAvoidRouting` routes `x→y` around it. `createSpecRouter` skips every spec that
  has `derivePose` ("A derived box, a cluster's, is none"), so on the spec path `x→y` crosses `C`. Its doc claims it
  reads obstacles "as `avoidSceneInput` reads a scene". The question "is a cluster box an obstacle?" gets two
  different answers.
- evidence: read
- severity: medium

## A leg with no path in any window loops forever when the routing limit is not finite
- where: packages/diagram/src/avoid/edgeRoute.ts:61-67 (routeEdge), with router.ts:45 (limitOf)
- scenario: one obstacle box (or a waypoint or port) has a NaN or infinite coordinate, so `limitOf` returns
  NaN or Infinity. Take a leg whose target point can be reached, but not with the arrival heading it needs: the
  port faces a neighboring shape closer than the clearance, so the arrival line is blocked while the region is
  still open to the window edge. `searchLeg` then returns `null` (not `ENCLOSED`) in every window. With a finite
  limit the loop stops once the window covers the limit. Here `within(limit, window)` is never true: NaN compares
  false, and once `grow` overflows, `x + width` is `-Inf + Inf = NaN`. So `for (;;)` doubles forever and the commit
  hangs.
- evidence: read
- severity: medium

## A preview over budget can show a stale route left from a canceled drag
- where: packages/diagram/src/avoid/router.ts:115-119 (preview)
- scenario: drag a shape and cancel it, so no edit and no commit runs. `previews` is cleared only in `commit`, so
  it still holds that drag's routes. Then drag another shape whose frame runs out of `budgetMs`. Each connector
  it doesn't reach gets `previews.get(id)`, a route computed for the canceled drag's positions, instead of being
  left at its document route.
- evidence: read
- severity: low

## A drag's first frames can show the previous drag's preview routes
- where: packages/diagram/src/avoid/install.ts:89-104 (avoidFollower, still)
- scenario: drag `A` and release; the commit reroutes and nudges. Then press `A` again without moving a full
  pixel, possibly after another edit has moved `B`. `last` outlives the drag (`finish` doesn't clear it), and the
  new frame has the same ids within `pixelSize`. So `still` returns `last.out`: the old drag's un-nudged
  previews, computed before the commit and before `B` moved, and possibly naming connectors deleted since.
- evidence: read
- severity: low

## The spec router never routes a self-loop, while the scene router routes one with both ports named
- where: packages/diagram/src/avoid/specRoutes.ts:96 (createSpecRouter)
- scenario: an edge `a→a` with `from.port: 'e'` and `to.port: 'n'`. sceneInput.ts:119 skips a self-loop only when
  a port is missing, so it gets routed. `createSpecRouter` drops it on `a === b` regardless of ports.
- evidence: read
- severity: low

## The spec router makes no obstacle of an off-page connector's label; the scene router does
- where: packages/diagram/src/avoid/specRoutes.ts:93 (createSpecRouter) / labelsOf
- scenario: a labeled `offPage` edge. `avoidSceneInput` files its label as a `label` obstacle
  (sceneInput.ts:109-112). `createSpecRouter` skips the edge, and its label is never filed, so spec-routed
  connectors run through it.
- evidence: read
- severity: low

## nearEdges indexes past the end of the shapes when the last shape starts a row
- where: packages/diagram/src/avoid/avoidFixture.ts:78 (nearEdges)
- scenario: `shapes.length = 7` gives `cols = 3`. When `i = 6` (column 0), `j` often comes out `>= 7` or `=== i`,
  and the fallback is `j = i + 1 = 7`. Then `shapes[7]!` is undefined and `edgeBetween` throws reading `.id`.
  The same happens for any count of the form `k*cols + 1` (13, …), and for a single shape.
- evidence: read
- severity: low

## The full-route bench reports only the last layout's unrouted count
- where: packages/diagram/src/avoid/avoid.bench.ts:100 (fullRoute)
- scenario: `failed` is overwritten on each of the three runs, so the printed "unrouted" count comes from layout 5
  alone. Connectors left unrouted in layouts 3 and 4 never show.
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

<!-- done: 9 findings, files read: 25 -->
```