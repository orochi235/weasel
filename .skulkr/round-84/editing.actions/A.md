# Audit round 84 — editing.actions

## Rotate records a Transform Again repeat of `frame.delta` even when a behavior's `onEnd` ops replaced the rotate
- where: packages/editing/src/actions/rotate/action.ts:58 (rotateAction onEnd), with packages/editing/src/actions/rotate/commit.ts:38 (commitRotate)
- scenario: a rotate binding carries a behavior whose `onEnd` returns its own `Op[]` (e.g. a snap-to-something or a replace-with-other-op behavior). `commitRotate` commits those ops via `commitRunOps` and returns true, and `onEnd` then calls `recordTransform(scene, { kind: 'rotate', angle: frame.delta, … }, subject)`. Ctrl+D afterwards replays a plain rotation by `frame.delta`, which is not what was committed. Clone answers the same question the other way: `commitClone` returns `repeat: null` for behavior ops it did not build and the action calls `forgetTransform`. Rotate should forget (or record nothing) when a behavior's ops were the commit.
- evidence: read
- severity: medium

## `selectFromLasso` aborts the whole lasso when the adapter lacks `hitTestLasso`, instead of falling through or using `hitTestArea`
- where: packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts:38 (selectFromLasso onEnd)
- scenario: under a host whose `LassoSelectAdapter` has `getSelection`/`hitTestArea` but no `hitTestLasso` (the action itself treats a polygon test as optional and falls back to the AABB in `hitTestPolygon`), the behavior returns `null`. `reduceBehaviorEnd` reads `null` as "abort", so the lasso changes nothing — not even the tiny-lasso clear, which needs no hit test at all. It should return `undefined` (fall through) or use the AABB fallback the default commit uses.
- evidence: read
- severity: low

## Lasso module doc promises `params.mode`, but the action's option surface has no `mode`
- where: packages/editing/src/actions/lassoSelect/action.ts:6 (module doc) vs packages/editing/src/actions/lassoSelect/options.ts:6 (UseLassoSelectOptions)
- scenario: the action reads `params?.mode` and the doc says the hit mode comes from the binding's `params.mode`, but `UseLassoSelectOptions` — the exported "Options for the `lasso-select` action" — lists only `behaviors` and `minVertexSpacing`. A consumer typing their options against it cannot set the mode it documents (`'contain'` vs `'intersect'`) without a type error.
- evidence: read
- severity: low

## Reorder's `enabled` answers true with no scene while `run` does nothing
- where: packages/editing/src/actions/reorder/reorder.ts:79 (reorderEnabled)
- scenario: with `operands` wired but no `scene` dep, `enabled` returns `true` (`if (!scene) return true`), so the menu shows Bring Forward / Send Backward as enabled, yet both invokers return immediately on `!scene`. Every other command in the area (flip, transformAgain, booleanGroup) answers `NotApplicable` without a scene, so this is the same question answered two ways.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/align/action.tsx
packages/editing/src/actions/align/align.ts
packages/editing/src/actions/align/index.ts
packages/editing/src/actions/clipboard/action.ts
packages/editing/src/actions/clone/action.ts
packages/editing/src/actions/clone/behaviors.ts
packages/editing/src/actions/delete/delete.ts
packages/editing/src/actions/derivedBox.ts
packages/editing/src/actions/distribute/action.tsx
packages/editing/src/actions/distribute/distribute.ts
packages/editing/src/actions/distribute/index.ts
packages/editing/src/actions/distribute/plan.ts
packages/editing/src/actions/flip/action.ts
packages/editing/src/actions/flip/helpers.ts
packages/editing/src/actions/group/enterGroup.ts
packages/editing/src/actions/lassoSelect/action.ts
packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts
packages/editing/src/actions/lassoSelect/index.ts
packages/editing/src/actions/lassoSelect/options.ts
packages/editing/src/actions/lockedWrites.ts
packages/editing/src/actions/pathfinder/action.tsx
packages/editing/src/actions/pathfinder/booleanGroupAction.ts
packages/editing/src/actions/pathfinder/keymap.ts
packages/editing/src/actions/reorder/reorder.ts
packages/editing/src/actions/rotate/action.ts
packages/editing/src/actions/rotate/commit.ts
packages/editing/src/actions/rotate/frame.ts
packages/editing/src/actions/rotate/replay.ts
packages/editing/src/actions/rotate/session.ts
packages/editing/src/actions/select/areaSelect.ts
packages/editing/src/actions/select/clearSelection.ts
packages/editing/src/actions/swap/action.ts
packages/editing/src/actions/swap/swapOps.ts
packages/editing/src/actions/transformAgain/action.ts
packages/editing/src/actions/transformAgain/transformSelection.ts

<!-- done: 4 findings, files read: 35 -->
