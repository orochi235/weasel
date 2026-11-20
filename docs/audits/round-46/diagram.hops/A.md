# diagram.hops findings

## The hop pass's cached routes (`held`) go stale on undo/redo, so later edits compute hops against routes the scene no longer has
- where: packages/diagram/src/hops/install.ts:119-151 (installHops → pass)
- scenario: Edit passes never run on undo, redo or history replay (packages/core/src/core/scene/editPass.ts:8-9, 41-43), but `held.polylines` is only updated inside the pass. So after an undo, `held` still holds the routes from before the undo. Example, using the fixture in hops.scene.test.ts: hops are on, and `cd` hops over `ab`. Move `c` and `d` to x=600 (held now has `cd`'s moved route), then undo both moves (the scene's `cd` is back across `ab` with its hop restored, but `held` still has it at x=600). Now move `a` and `b` down 40. `ab` is a candidate, but `cd`'s cached box is at x=600 and doesn't meet `ab`'s boxes, so `cd` isn't recomputed. Its stored hop stays at y=30, more than 0.5 off its route, and `withHops` drops it: `cd` crosses `ab` with no hop. If `cd` does land in `affected`, `edgeHops` runs on its stale cached route and writes hops that don't lie on the real route, so nothing draws there either. `reordered` only catches an undone reorder; an undone move, reroute or data edit leaves the cache wrong until the setting is toggled. `untracked` edits, which aren't summarized, leave it wrong the same way.
- evidence: read
- severity: medium

## The drag follower doesn't hide hops on connectors whose end has a derived pose, though the commit pass counts those ends as moved
- where: packages/diagram/src/hops/follower.ts:20-22 (hopFollower.preview), vs packages/diagram/src/hops/install.ts:75-77 (candidates)
- scenario: `candidates` treats a connector as possibly rerouted when an end `derived(end)` has a `derivePose`, for example a container that auto-fits its children or a node posed from others. `hopFollower` decides `moved` only from `frame.has(id)` and `inOrUnder(end, frame)`, which walks up to ancestors and never down to the nodes a derived pose is computed from. Example: drag a child of an auto-fit container that a connector attaches to. The container's pose follows the child, so the connector reroutes during the drag. But that connector isn't in `moved`, so its own hops stay at their committed spots, and connectors hopping over it keep bumps over a line that has moved away. The two halves answer "did this connector move?" differently.
- evidence: read
- severity: low

## A redundant collinear vertex in a route suppresses every crossing within `r` of it, though there is no bend there
- where: packages/diagram/src/hops/crossings.ts:120-131 (edgeHops)
- scenario: Each segment is handled alone, and a crossing with `t < r || len - t < r` is skipped as "too near a bend". With a route like `[(0,0), (100,0), (200,0)]` (straight, with a midpoint that a waypoint or a stored route can leave behind), another connector crossing at x=102 with r=5 gets no hop, even though the half circle would fit on the straight run.- evidence: read
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

<!-- done: 3 findings, files read: 10 -->
