The findings file couldn't be written. It accepted the first three sections, then every later write was refused as needing permission. Here is the whole document instead:

# Findings: diagram.part2

## diagramScene reserves layout room for labels the options station at an end or a fraction
- where: packages/diagram/src/fromData.ts:67 (labelRoomOf)
- scenario: `diagramScene(data, { labelPlacement: { at: 'start' } })` with labeled edges and no per-edge `labelPlacement`. `labelRoomOf` only checks `e.labelPlacement.at`, so every labeled edge still asks layered for label room. Meanwhile `dataEdges.ts:37` draws the label from `e.labelPlacement ?? opts.labelPlacement`, at the start of the wire. Layout spreads ranks apart for labels that never sit there. The room check should read the same `e.labelPlacement ?? opts.labelPlacement ?? LABEL_PLACEMENT` that the drawing reads, as line 69 already does for `offset`.
- evidence: read
- severity: medium

## A live run restarted onto a planner leaves the previous run's eased edge paths held in the override channel
- where: packages/diagram/src/live.ts:231 (restart), also :255 (stop) and :221 (planner failure)
- scenario: `useLiveLayout({ algorithm: <planner> })` is running and easing routes when an edge is added, so the reheat subscription calls `restart()` (line 245).
  - `restart` drops the pending plan and cancels the pose run, but never calls `eased.drop()`; only `cancel` (line 256) does.
  - `build()` returns false while the planner is asked again, so `install` → `eased.set` (which would drop the hold) has not run.
  - `run.cancel()` puts the nodes back at their document poses. The pose run releases only its own hold, not the `pathHold` entries, so each eased edge keeps the path override from the cancelled run's last frame, drawn away from its ends.
  - Nothing ever releases that hold if the answer is dropped (`sameGraph` false at line 218, which is exactly what a mid-run edit produces), if the planner rejects, or if `stop()` is called while waiting (`run.stop()` commits nothing, so `onCommit`'s `eased.drop()` never fires). The edges stay frozen on the stale path until the component unmounts.
  - Fix: `restart`, and `stop` while only a plan is pending, should drop the eased routes the way `cancel` does.
- evidence: read
- severity: medium

## buildGraph lays a fitted container out as one rigid box, where diagramScene lays out its members around it
- where: packages/diagram/src/graph.ts:245 (outermostRegions)
- scenario: data with a `DataContainer` that gives no `box`, holding three nodes. `dataContainers.ts:105` marks it fitted, and its scene node carries `container.fitted: true`.
  - `diagramScene` treats it as a cluster: the members are laid out one by one and the box is fitted around them (`rootOf` skips fitted regions at dataContainers.ts:168).
  - `layoutDiagram`, `diagram.layout` and `useLiveLayout` on the resulting scene go through `outermostRegions`, which adds every non-lane container to `regions`, fitted ones included. The three members are skipped as participants (`outer.has(node.id)`, line 187), edges into them rank against the container, and the container moves as one block, keeping whatever arrangement its members had.
  - The same diagram gets two different layouts depending on the entry point, contrary to the comment's "as `diagramScene` lays out a boxed region". `outermostRegions` should skip `fitted` containers the way `containerLayoutNodes` does.
- evidence: read
- severity: medium

## createSpecLabelPlacer places a split connector's label on the whole cross-page route, not on the stubs it draws
- where: packages/diagram/src/labels/specLabels.ts:31 (inputOf)
- scenario: `diagramScene` with pages, where an edge's ends sit on different pages, so it comes out with `diagram.offPage` set (fromData.ts:253-255).
  - Its drawn path is the two stubs (`edgeRouter` answers `stubs`, edge.ts:219), and its label derives its pose on the first stub (`labelCenter` reads `subpathOf(path, 0)`).
  - `inputOf` files `routeOf(...).points`, the full route across the page gap, and ignores `stubs`.
  - Placement therefore scores candidate boxes along a line that is not drawn. It returns an `at` that is a fraction of that long route, which `labelDerivePose` then applies to the 24-unit stub. Every other label dodges the undrawn cross-page segment and does not dodge the stubs.
  - The live pass (`labels/install.ts`, `runsOf` and `more`) reads the drawn runs. The spec placer should file `stubs[0]` as `points` and `stubs[1]` as `more` when stubs are present.
- evidence: read
- severity: medium

## createSpecLabelPlacer's cache key leaves out `inset`, which placement reads
- where: packages/diagram/src/labels/specLabels.ts:51 (keyOf)
- scenario: an edge label is `{ at: 'start', inset: 4 }`, and the host changes only `inset` to 20 and re-runs the placer. `candidatesOf` (place.ts:131) and `labelCenter` use `inset` to station the preferred box, so every candidate's cost changes. But `keyOf` keys labels on `at`, `offset`, `dodge` and size only, so the key matches and the answer placed for the old inset is reused. A label now covered at its new preferred spot is not moved, or a label moved off is kept off a spot that is now clear.
- evidence: read
- severity: low

## buildGraph keeps an edge from a region to its own member as a self-loop that diagramScene drops
- where: packages/diagram/src/graph.ts:163 (buildGraph)
- scenario: an outermost boxed region `R` holds a node `c`, and there is an edge `R -> c`.
  - `outer.get(R)` is undefined (no region above `R`) and `outer.get(c)` is `R`, so the `from !== undefined && from === to` guard does not fire. The graph gets an edge `R -> R`, port kept.
  - `diagramScene`'s `layOut` maps both ends through `boxes.endOf`, gets `R` for both, and drops the edge (fromData.ts:303).
  - Layouts therefore see an edge the data path never gives them. The guard should compare the resolved ends: `(from ?? deps[0]) === (to ?? deps[1])`.
- evidence: read
- severity: low

## Files read
packages/diagram/src/faceCapCenter.ts
packages/diagram/src/faceRemeasure.ts
packages/diagram/src/firstSight.ts
packages/diagram/src/footprint.ts
packages/diagram/src/force.ts
packages/diagram/src/forceClusters.ts
packages/diagram/src/fromData.ts
packages/diagram/src/graph.ts
packages/diagram/src/grid.ts
packages/diagram/src/headerClick.ts
packages/diagram/src/icons.gen.ts
packages/diagram/src/icons.table.ts
packages/diagram/src/imageRelease.ts
packages/diagram/src/index.ts
packages/diagram/src/itemDrop.ts
packages/diagram/src/itemDropTarget.ts
packages/diagram/src/keyedIndex.ts
packages/diagram/src/label.ts
packages/diagram/src/labelCommands.ts
packages/diagram/src/labelDragLayer.ts
packages/diagram/src/labelTrait.ts
packages/diagram/src/labels/fit.ts
packages/diagram/src/labels/install.ts
packages/diagram/src/labels/labels.bench.ts
packages/diagram/src/labels/place.ts
packages/diagram/src/labels/specLabels.ts
packages/diagram/src/labels/station.ts
packages/diagram/src/labels/useLabelPlacement.ts
packages/diagram/src/layered.ts
packages/diagram/src/layout.entry.ts
packages/diagram/src/layout.ts
packages/diagram/src/layoutAction.ts
packages/diagram/src/layoutFixture.ts
packages/diagram/src/layoutFrame.ts
packages/diagram/src/live.ts
packages/diagram/src/liveFixture.ts
packages/diagram/src/livePlan.ts
packages/diagram/src/liveProducers.ts
packages/diagram/src/liveRoutes.ts
packages/diagram/src/marks.ts
packages/diagram/src/mirrorSelection.ts
packages/diagram/src/moveLabelAction.ts
packages/diagram/src/offPage/endBox.ts
packages/diagram/src/offPage/follow.ts
packages/diagram/src/offPage/install.ts
packages/diagram/src/offPage/pagedFixture.ts
packages/diagram/src/offPage/split.ts
packages/diagram/src/offPage/tag.ts
packages/diagram/src/offPage/trait.ts
packages/diagram/src/offPage/useOffPageMarkers.ts

<!-- done: 6 findings, files read: 50 -->