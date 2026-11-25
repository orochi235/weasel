# Audit round 87 — editing.actions

## Make Boolean Group takes page structure from the selection into the group
- where: packages/editing/src/actions/pathfinder/booleanGroupAction.ts:94 (makeBooleanGroupAction run / enabled → booleanGroupOps)
- scenario: the selection holds a page (or the page run) plus two shapes on it. `enabled` passes `requiresContent(2)` (which counts content without page structure), but then hands `operands.get()` whole to `rootsAmong`/`booleanGroupOps`; the page is the root of the selected shapes, so the op list reparents the page itself under a new boolean group (or, with a page and one other root, enables on two "roots"). Group, Delete, Align, Flip, and Swap all strip page structure first (`operandContent` / `withoutPageStructure`); this command should do the same, so the pages are left alone and only the shapes get grouped.
- evidence: read (compare `edit/group.ts:239` using `operandContent`)
- severity: medium

## Transform Again translates/rotates page structure, unlike the nudge/move it repeats
- where: packages/editing/src/actions/transformAgain/action.ts:33 (replay) and packages/editing/src/actions/transformAgain/transformSelection.ts:33,47 (selectionTransformAnswer, transformSelection)
- scenario: after a nudge (which records a `translate` over `operandContent`, without the page), the user selects a page along with content and presses Cmd+D. `replay` passes `deps.operands.get()` unfiltered to `moveNodesOps` / `rotateSelectionOps` / `resizeSelectionOps`, none of which filter page structure (`moveEachOps`, `shapeSources` don't), so the page moves, turns, or resizes. Nudge (`edit/nudge.ts:40`) refuses to move it, and the duplicate branch of `canRepeat` uses `requiresContent`. The same selection gets two different answers about whether a page moves. It also records the page in the repeat's subject.
- evidence: read
- severity: medium

## Clone copies a selected page
- where: packages/editing/src/actions/clone/action.ts:190 (cloneAction start: `ids = selection.get()`, `translateTargets`, `rootsAmong`)
- scenario: Alt-drag with a page in the selection. Neither `translateTargets` nor `rootsAmong` drop page structure, so `copyOps` copies the page node and its subtree as an ordinary node. Duplicate, Delete and Group skip page structure ("pages are removed through the page API"), so clone should skip it too.
- evidence: read (translateTargets in core/interactions/actions/selectionSubtree.ts:119 does no page filtering)
- severity: low

## Lasso behaviors get no `plane` (or `kitSettings`), though the lasso itself measures in the plane
- where: packages/editing/src/actions/lassoSelect/action.ts:98 (start, gesture context) and :140 (onMove)
- scenario: a lasso on a parallax layer with a behavior or snap strategy that converts screen tolerance or guides through `gctx.plane`. `start` builds `readPlane` and uses it for its own vertex spacing, but never sets `gesture.plane`, and `onMove` refreshes only `view`. The behavior therefore treats the plane as identity and measures in the wrong world. Clone (`clone/behaviors.ts`) and rotate (`rotate/session.ts`, `frame.ts`) both set `plane` and `kitSettings` and refresh them on every move.
- evidence: read (GestureContext.plane in core/interactions/gestures/types.ts:47)
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
