# Audit round 81 — core.interactions.actions.part2 — blind reviewer findings

## useActionSet keys registration on action ids only, so a rebuilt action with the same id stays the stale one
- where: packages/core/src/interactions/actions/useActionSet.ts:98-113 (useActionSet)
- scenario: `useSceneStandardActions` passes `standardActions` (baseline plus every surface contribution's `actions`) to `useActionSet`. A contribution rebuilt over new inputs keeps its action ids — e.g. diagram's `createDiagramSequenceContribution({ scene, commit })` (packages/diagram/src/sequence/actions.ts:166) builds `createSequenceDragAction({ ...opts })` closing over `scene`, and `useDiagramEditing` rebuilds it when `scene` changes. `actionsKey` (the id list) is unchanged, so the effect does not rerun and the registry keeps the first action object, which still closes over the old scene/commit. The new action, with its new closures, is never registered; drags keep acting on the previous scene. Should re-register when an action object changes (key on identity, or read through `actionsRef` at invocation).
- evidence: read
- severity: medium

## resolvePreviews returns a previewed node twice when a carrying ancestor above its unpreviewed parent is also previewed
- where: packages/core/src/interactions/actions/resolvePreviews.ts:132-139, 113-117 (resolvePreviews / build)
- scenario: frame-composing scene; container G (defines a frame) and its grandchild C are both in `previewIds` (e.g. C added by a transform follower), C's parent P is not. The root loop only skips an id whose *direct* parent is previewed, so C becomes a root. `build(G)` has `carries` true and recurses with `riding`, so it builds P and, under it, C as well. C appears in the forest twice and its ghost is painted twice (double alpha, and a consumer flattening the forest sees the id twice). The root check should test whether any ancestor that will carry it is previewed.
- evidence: read
- severity: low

## resolveSpatialReference accepts NaN / Infinity coordinates as a valid rect
- where: packages/core/src/interactions/actions/spatialReference.ts:47-54 (resolveSpatialReference)
- scenario: `ref = { x: NaN, y: 0 }` (or `width: Infinity`) passes the `typeof === 'number'` checks and returns `{ x: NaN, … }`; align/flip then write NaN poses. The doc promises `null` for "a malformed value"; non-finite numbers should be rejected (`Number.isFinite`).
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
