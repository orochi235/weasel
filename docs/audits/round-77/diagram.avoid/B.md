# Audit round 77 — diagram.avoid (blind reviewer)

## A drag frame's search limit grows to a moved shape's bare box, without the margin a commit's limit keeps
- where: packages/diagram/src/avoid/dragIndex.ts:85 (DragIndex.frame)
- scenario: drag a shape whose end uses one named port well past the committed scene's bounds. `limitOf` (router.ts) gives a commit's limit `2 * margin` of room past every box and port, but the frame's limit is `unionRects([limit, o.box])`: the moved shape's raw box, not even its inflated box. A leg whose route must wrap around the far side of the dragged shape stops growing its window as soon as the window covers that bare box, which can leave the inflated box's far side (and the channel past it) outside the window; the preview then answers null (the connector falls back to `orthogonal` mid-drag) or a detour, where the commit that follows routes it fine. The same question — how far a window may grow — is answered two ways; the frame should grow the limit by the moved obstacle's inflated box plus `2 * margin`, as `limitOf` does.
- evidence: read (inferred from the two limit computations; not run)
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

<!-- done: 1 findings, files read: 25 -->
