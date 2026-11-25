# Audit round 42 — core.interactions.actions.part1

## `enumerateAnchors` ignores a subpath a drawing command opens after `Z`, so it and `pathToAnchors` number anchors differently
- where: packages/core/src/interactions/actions/edit-anchors/geometry.ts:50 (enumerateAnchors)
- scenario: a path `M0 0 L10 0 L10 10 Z L20 20 C 30 30 40 40 20 20 Z` (valid SVG: a drawing command after `Z` starts a subpath at the closed subpath's start). `pathToAnchors` (packages/geom/src/paths/anchors.ts:56) reads `opensSubpath` and adds the implicit start anchor `{0,0}` to the second subpath, gives it the outgoing C's `outHandle`, and folds the closing curve onto it. `enumerateAnchors` takes no `opensSubpath`: after `Z` it has `lastAnchor = firstInSubpath = null`, so it counts no implicit start, attaches no `controlOut` for the first C, and never folds the second subpath's closing curve (its `firstInSubpath` stays null). The flat anchor indices `editAnchors` carries (`anchor:N`, `selectedAnchors`) then name different points from the anchor model the anchor commands rebuild through `pathToAnchors`/`anchorsToPath`, contradicting the docstring's "so the two walkers count alike"; a drag on the second subpath's start moves the curve end without its handle.
- evidence: read (both walkers)
- severity: medium

## `commitOps` reads `deps.operands` with no `select`, the one read its own comment says must be skipped
- where: packages/core/src/interactions/actions/defaultCommitAdapter.ts:84 (commitOps)
- scenario: line 69 reads `deps.operands` only when `select` is given, because a dispatcher's dev deps Proxy (`packages/routing/src/interactions/actions/buildDeps.ts:31`) throws on a dep the action did not declare. Line 84 then reads `operands ?? deps.operands` on the scene fallback anyway, so an action that declares `scene` and `applyOps` but not `operands`, on a canvas with no `applyOps` hook sourced, calling `commitOps(deps, ops, label)` with no `select`, throws `read deps.operands but did not declare it` in dev instead of committing. Should be `operandMethods(operands)` or guard the read the same way line 69 does.
- evidence: read
- severity: low

## `moveEachOps` lets a later entry move a node an earlier zero-delta entry reached, against "a node two entries reach takes the first one's delta"
- where: packages/core/src/interactions/actions/moveNodes.ts:95 (moveEachOps)
- scenario: align or distribute with a group and one of its children both selected: `moves = [{ ids: [group], dx: 0, dy: 0 }, { ids: [child], dx: 30, dy: 0 }]` (the group already sits on the target edge). The zero-delta entry `continue`s before its `translateTargets` are added to `claimed`, so the child is unclaimed and the second entry moves it 30 out of its group. Had the group's delta been 1, the group's entry would claim the child and the child would ride with the group, not take its own 30. Whether the child leaves its group depends on whether the group happened to already be aligned. The zero-delta entry should still claim its targets (and only skip emitting ops).
- evidence: read (callers: packages/editing/src/actions/align/action.tsx:71, distribute/action.tsx:54)
- severity: low

## `translateAnchor` moves a one-segment quadratic loop's control twice
- where: packages/core/src/interactions/actions/edit-anchors/geometry.ts:123 (translateAnchor)
- scenario: a teardrop `M0 0 Q50 100 0 0 Z`. `enumerateAnchors` gives the M anchor `controlOut = { coordIndex: ci }` (the Q's control), and `foldClosingCurve` then sets its `controlIn` to the folded end anchor's `controlIn`, which for a Q is the same `coordIndex: ci`. Dragging the anchor by (dx, dy) adds the delta to `next[ci]` twice (lines 124 and 130), so the control moves by 2·delta and the loop changes shape instead of translating rigidly.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/actions/actionGroups.ts
packages/core/src/interactions/actions/actionParamSchema.ts
packages/core/src/interactions/actions/actionParams.extension.fixture.ts
packages/core/src/interactions/actions/actionParams.typetest.ts
packages/core/src/interactions/actions/admitsChild.ts
packages/core/src/interactions/actions/canSwap.ts
packages/core/src/interactions/actions/defaultCommitAdapter.ts
packages/core/src/interactions/actions/depSchema.ts
packages/core/src/interactions/actions/drawnBoxes.ts
packages/core/src/interactions/actions/dropVerdict.ts
packages/core/src/interactions/actions/duplicateOffset.ts
packages/core/src/interactions/actions/edit-anchors/geometry.ts
packages/core/src/interactions/actions/edit-anchors/params.ts
packages/core/src/interactions/actions/editAnchorsDep.ts
packages/core/src/interactions/actions/editDeps.ts
packages/core/src/interactions/actions/engineDeps.ts
packages/core/src/interactions/actions/finiteFrame.ts
packages/core/src/interactions/actions/followerMoves.ts
packages/core/src/interactions/actions/geometryProjection.ts
packages/core/src/interactions/actions/gestureFrames.ts
packages/core/src/interactions/actions/groupSlot.ts
packages/core/src/interactions/actions/hitSelection.ts
packages/core/src/interactions/actions/ingestionDeps.ts
packages/core/src/interactions/actions/insertDeps.ts
packages/core/src/interactions/actions/layoutDeps.ts
packages/core/src/interactions/actions/magnification.ts
packages/core/src/interactions/actions/moveNodes.ts

<!-- done: 4 findings, files read: 27 -->
