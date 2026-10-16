---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
---

`layered` routes long edges and leaves labels room on a live scene too.

- **Under `order: 'seeded'`.** An edge spanning ranks now stands in each rank it crosses and a
  labeled edge gets a rank of its own, as under `'barycenter'`. An edge keeps its place in a rank
  the way a node does, from where its route crosses that rank now (`GraphEdge.waypoints`, which
  `buildGraph` fills in), so a second run still moves nothing. This changes where a seeded layout
  puts nodes in any graph with a long or labeled edge.
- **Written to the scene.** The layout action and a live `layered` run write each long edge's
  waypoints, and station its label in the room left for it, in the same undo entry as the moves.
  `buildGraph` reads a scene label's size as its edge's label room.
- **Whose route it is.** `DiagramEdge.laidOut` records the waypoints layout wrote, and layout
  rewrites a route only while the edge's waypoints still match them (`layoutOwnsRoute`). An edge
  someone has bent, and the label on it, are left alone, and get no room in the ranks the edge
  crosses (`GraphEdge.authored`); so is a label put at `'start'`, `'end'` or a fraction.
  `diagramScene` marks the routes it lays out the same way. A layout that routes nothing
  (`tree`, `force`, `chain`) takes layered's routes back off.
- **`diagramScene`.** A label whose edge sets `labelPlacement` at `'mid'` now gets room beside
  its wire like an unplaced one, at that placement's offset. Routes come from any layout with a
  `plan`, not only `layered`.
- **Locked layers.** `applyLayout` skips a node, edge or label on a locked layer instead of
  throwing.
- **New surface.** `LayoutFn` may carry a `plan` returning `LayoutPlan` (`moves`, `waypoints`,
  `labels`); `layered.plan` is `layeredPlan`, and `planOf` reads any layout's. `routesOf` and
  `routeWrites` turn a plan into scene edits, and `applyLayout` takes them as `routes`.
  `usePoseRun` takes `commitWith`, writes of the caller's own made inside the commit's batch.
- `expand`'s `placeholders` and `labels` options are gone; it always adds both.
