# Findings: core.interactions.actions.part2

## translateTargets drops a group's children under IDENTITY_POSE_COMPOSITION, where uncarried keeps them
- where: packages/core/src/interactions/actions/selectionSubtree.ts:128 (translateTargets)
- scenario: a scene on `IDENTITY_POSE_COMPOSITION` (stored pose = world pose, containers carry nothing) with a plain group `g` (not an envelope) holding a mark `m`. Move or clone `[g]`: `frame.frame(m)` is `g` (frameAtOrAbove only checks `definesFrame`, which is true for every non-envelope regardless of the composition), so `m` is filtered out as "carried" and never written. The group's pose moves; its child, whose world pose is its stored pose, stays where it was (clone: the copied child lands on the original). `uncarried` in the same file answers the same question with a `!composesFrames(frame.pc)` guard, so resize/rotate/flip/align write both (docs/unruled.md:1630 rules that), while move and clone (moveNodes.ts:97, editing clone/action.ts:140, move/capture.ts:65) leave the child behind. `move.carried.test.ts:73` pins the move half, but its own title says identity containers "carry nothing", which is the reason the child must be written.
- evidence: read
- severity: medium

## actionReferenceSources answers 'pointer' in the camera's world and `{ node }` in the node's plane, then align/flip apply it to poses in another plane
- where: packages/core/src/interactions/actions/spatialReference.ts:66 (actionReferenceSources)
- scenario: a scene with a `parallax` layer `bg` (factor 0.5) and the view panned. Select a node on `bg` and run align with `reference: 'pointer'` (or flip with `pivot: 'pointer'`). `pointer()` returns `params.world` / the `pointer` dep's `world`, both in the camera's world, while `nodeBounds` and the selection's boxes come from `frame.world`, the plane's world where `bg` nodes are stored. Neither `align` nor `flip` is wrapped in `inPlane` (editing align/action.tsx:67, flip/action.ts:107), and nothing here carries the point through `view.planeOf(layer)`, so the node lands where the camera-world number falls in its plane — off the pointer by the parallax offset. Likewise `{ node }` naming a node on another plane mixes two worlds. planeInput.ts states the rule this breaks: an editing action pairing the pointer with a pose has to have both in one world.
- evidence: read
- severity: medium

## resolveSpatialReference accepts non-finite x/y/width/height
- where: packages/core/src/interactions/actions/spatialReference.ts:47 (resolveSpatialReference)
- scenario: `reference: { x: NaN, y: 0 }` or `{ x: 0, y: 0, width: Infinity }` (e.g. from a parsed URL or a computed value). `typeof NaN === 'number'`, so the check passes and a NaN/Infinite rect is returned; align or flip then writes NaN poses into the scene. The docstring promises `null` for "a malformed value", which is what a non-finite number is; planeInput.ts already treats a non-finite press as landing nowhere (`finiteThroughout`).
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
