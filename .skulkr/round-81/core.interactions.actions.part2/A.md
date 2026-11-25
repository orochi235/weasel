# Audit round 81 — core.interactions.actions.part2

## resolvePreviews returns a previewed node twice when a carrying ancestor above its unpreviewed parent is also previewed
- where: packages/core/src/interactions/actions/resolvePreviews.ts:131 (resolvePreviews, root loop) with :106 (build)
- scenario: frame-composing scene, G (a container whose pose defines a frame) holds P (not previewed) which holds C. A gesture's sources name G and C (e.g. a transform follower previewing C while G moves). `build(G)` has `carries` true, so it builds P with `riding = true`, P then carries and builds C: C sits under G's entry. The root loop only checks C's immediate parent (`ids.has(P)` is false), so C is also built as a root of its own. The forest holds C twice and `flattenPreviews` yields it twice, so the ghost layer paints C's ghost twice (doubled alpha) and a consumer iterating the entries processes it twice. Should skip a root that any carrying/previewed ancestor already reaches, not just a previewed direct parent.
- evidence: read
- severity: medium

## withPath's per-node cache ignores the node's frame, returning a stale local pose after the parent moves
- where: packages/core/src/interactions/actions/pathCommands/pathNodes.ts:83 (withPath)
- scenario: `lastStored` is keyed on `target.node` and checks only `held.path === worldPath`. The cached shape was computed from `target.shown` (the world pose, which depends on the parent's frame) and `target.local` (the parent frame's inverse). If the node's parent is moved or turned while the node object itself is unchanged (immutable scene: the child's object identity survives a parent edit), a later call with the same `worldPath` object returns the shape computed under the old frame, so the stored pose lands where the old frame put it, not at `worldPath` in world. The key should cover the frame (or `target.shown`) as well as the node.
- evidence: read
- severity: low

## A line insert preview with only one of `a`/`b` in extras keeps that end in the plane's world
- where: packages/core/src/interactions/actions/planeInput.ts:331 (insertExtrasFromPlane)
- scenario: `insertPreviewExtent` reads a line's `a` and `b` independently, falling back per end to the drag rect corner. `insertExtrasFromPlane` converts them only when both are present (`e['a'] && e['b']`), while `bounds` is always converted. An action publishing only `extras.a` on a parallax layer gets `a` drawn in plane coordinates against a `b` derived from camera-world bounds: the preview line is drawn from the wrong place. Each end should be converted when present.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/actions/moveOptions.ts
packages/core/src/interactions/actions/notices.ts
packages/core/src/interactions/actions/operands.ts
packages/core/src/interactions/actions/pathCommands/pathNodes.ts
packages/core/src/interactions/actions/pathGestureTags.ts
packages/core/src/interactions/actions/pbt.fixture.ts
packages/core/src/interactions/actions/pbtScene.fixture.ts
packages/core/src/interactions/actions/planeInput.ts
packages/core/src/interactions/actions/pointerState.ts
packages/core/src/interactions/actions/poseDescriptorDep.ts
packages/core/src/interactions/actions/poseFrame.ts
packages/core/src/interactions/actions/regionSelectDeps.ts
packages/core/src/interactions/actions/resizeOptions.ts
packages/core/src/interactions/actions/resolveOverlays.ts
packages/core/src/interactions/actions/resolvePreviews.ts
packages/core/src/interactions/actions/rotateOptions.ts
packages/core/src/interactions/actions/runLifecycle.ts
packages/core/src/interactions/actions/selectionSubtree.ts
packages/core/src/interactions/actions/settleWithinRounding.ts
packages/core/src/interactions/actions/snapDep.ts
packages/core/src/interactions/actions/spatialReference.ts
packages/core/src/interactions/actions/testUtils.ts
packages/core/src/interactions/actions/transform-again/memory.ts
packages/core/src/interactions/actions/transformFinish.ts
packages/core/src/interactions/actions/useActionSet.ts
packages/core/src/interactions/actions/useNotices.ts

<!-- done: 3 findings, files read: 26 -->
