# Audit round 46 — area `diagram.hops`

## The hop pass's held routes go stale after undo, redo or a history replay, and later edits compute hops against routes that are no longer there
- where: packages/diagram/src/hops/install.ts:119-151 (installHops → pass)
- scenario: Hops on. Connector A (earlier in render order) runs horizontally at y=100; connector B crosses it vertically and carries a hop over A. Move A's end shapes down so A runs at y=300: the pass sets `held.polylines[A]` to the y=300 route and clears B's hop. Undo: the scene puts A back at y=100 and restores B's hop data, but `addEditPass` passes never run on undo/redo/replay (`packages/core/src/core/scene/editPass.ts:38-43`), so `held.polylines[A]` still says y=300. Now nudge B's end shape sideways: the pass recomputes B only (`affected` = B plus connectors whose *held* boxes meet B's), runs `edgeHops` over `h.polylines` in which A is at y=300, finds no crossing and writes B with no hops, though B visibly crosses A at y=100. The reverse also happens: with A held at a stale spot, `samePoints(was, now)` can skip A as unchanged when it is not, leaving connectors that hop over A's old place with hops over nothing. Should: rebuild (or invalidate) `held` when history moves the scene — e.g. drop `held` whenever the summary is not a live edit, or subscribe to history and set `held = null` so the next pass runs `full`. A `loadState` of another document has the same effect.
- evidence: read
- severity: medium

## The drag follower leaves hops on connectors that an earlier follower reroutes without their ends moving
- where: packages/diagram/src/hops/follower.ts:19-27 (hopFollower → preview)
- scenario: `useAvoidRouting` mounted before `useHops`, as the README asks. Dragging a shape across connector C, which is attached to two other shapes, makes the avoid follower preview C rerouted around the dragged shape (`avoid/install.ts:102-116` previews every id in `frame.dirty`, not only attached connectors), and hands that data in `data`. hopFollower builds `moved` only from `frame.has(id)` and ends inside the frame, so C is not "moved": C keeps its stored hops through the drag (drawn wherever they still lie on the new route), and every connector hopping over C keeps a hop over the place C has left. Should: count a connector as moved when `data.has(id)` (its route was previewed by an earlier follower) as well.
- evidence: read
- severity: medium

## Hidden connectors, and connectors on hidden layers, still make the connectors above them hop
- where: packages/diagram/src/hops/sceneEdges.ts:24-33 (sceneEdges); used by install.ts:117 and follower.ts:18
- scenario: Connector A hidden (`hidden: true`, or its layer set invisible with `setLayerVisible`); connector B, later in render order, crosses where A would run. `sceneEdges` walks `renderOrderNodes()`, which is visibility-blind by design (`core/src/core/scene/renderOrder.test.ts:289`, "painters filter, not the walk"), so A's route enters `edgeHops` and B is written with a hop over A: B visibly jumps over nothing. Hiding A after the hops are written does not reroute A, so `candidates` never revisits B either. Should: leave hidden connectors (node or layer) out of the crossing set, and recompute neighbors when visibility changes.
- evidence: read
- severity: medium

## The follower answers a connector's stored pose, discarding a pose an earlier follower previewed for it
- where: packages/diagram/src/hops/follower.ts:30 (hopFollower → preview)
- scenario: `previewFollowers` (`core/src/interactions/actions/transformFinish.ts:73-90`) hands each follower the frame with the poses earlier followers previewed, and the last answer for an id wins in `out`; `createTransformPreview` then drops any answer equal to the stored pose (line 133). A connector whose pose an earlier follower previews (or one in the frame itself, whose dragged pose is in `frame`) and which also carries hops gets `{ pose: e.node.pose }` from hopFollower: `out` now holds the stored pose, the earlier preview's pose override is lost, and followers after this one read the stored pose in `seen`. Should: answer `frame.get(e.node.id) ?? e.node.pose`.
- evidence: read
- severity: low

## The follower and the pass disagree on which connectors a move reroutes: ends with a derived pose count in one and not the other
- where: packages/diagram/src/hops/follower.ts:20-22 vs packages/diagram/src/hops/install.ts:73-78 (candidates)
- scenario: Connector C ends on node N whose pose derives from the dragged shape (`derivePose`, e.g. a node pinned to another). The commit-time pass treats C as rerouted (`derived(end)` in `candidates`), but the drag follower's `moved` test is only `frame.has(id)` / `inOrUnder(end, frame)`, so during the drag N moves with its source, C's route moves, and C's stored hops (and hops over C) stay drawn until release. The same question — "does this edit move this connector?" — is answered two ways. Should: share one predicate, including derived-pose ends, between both.
- evidence: read
- severity: low

## Rounding a hop's center and radius separately can make a hop at the clearance limit fail to draw
- where: packages/diagram/src/hops/crossings.ts:25,55-60 (mergeAlong) vs packages/diagram/src/hops/draw.ts:42,49 (placedOn)
- scenario: `edgeHops` accepts a crossing at `t >= r` from a segment end, and keeps two hops apart when their crossings are exactly `2r` apart, then rounds `at.x`, `at.y` and `r` each to 0.001. `placedOn` re-derives `t` from the rounded `at` and rejects `t - r < 0`, `t + r > len`, or `p.t - p.r < last.t + last.r` with no tolerance. With fractional coordinates the rounding moves `at` by up to 0.0005 toward the end: e.g. a segment starting at x=0.0004, r=5, crossing at x≈5.0004 → `at.x` rounds to 5.000, `t` = 4.9996, `t - r` < 0, and the hop that `edgeHops` produced and stored is silently not drawn; likewise the second of two hops exactly `2r` apart can be dropped as "overlapping". Should: give `placedOn` a tolerance at least the rounding step, or round so the hop stays inside its accepted interval.
- evidence: read
- severity: low

## Files read
packages/diagram/src/hops/crossings.ts
packages/diagram/src/hops/draw.ts
packages/diagram/src/hops/follower.ts
packages/diagram/src/hops/hops.bench.ts
packages/diagram/src/hops/hopsAction.ts
packages/diagram/src/hops/install.ts
packages/diagram/src/hops/sceneEdges.ts
packages/diagram/src/hops/specHops.ts
packages/diagram/src/hops/types.ts
packages/diagram/src/hops/useHops.ts

<!-- done: 6 findings, files read: 10 -->
