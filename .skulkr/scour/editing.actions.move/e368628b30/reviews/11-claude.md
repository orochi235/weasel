# Findings: editing.actions.move

## A move whose commit a behavior owns still records a plain translate for Transform Again
- where: packages/editing/src/actions/move/action.ts:83 (moveAction invoker onEnd)
- scenario: drag one node over another with `swapOnDrop: 'dwell'` (or release with `snapBackOrDelete({ onFreeRelease: 'delete' })`, a `snapToContainer` slot, a layout drop into a slot) → `commitMove` returns true and the action calls `recordTransform(scene, { kind: 'translate', ...frame.delta }, subject)`. Cmd+D then translates the selection by the pointer's delta, a move the user never got (the swap traded places, the delete removed the subject, the slot placed it elsewhere). Resize answers the same question the other way: a constraint whose `onEnd` commits its own ops leaves nothing recorded (docs/unruled.md, 2026-11-20 ruling, audit round 47). Should record only when no behavior answered (the default translate path in `commitMove`), or nothing.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/action.ts, packages/editing/src/actions/move/commit/index.ts
- size: function
- cause: commit result doesn't say whether a behavior owned it
- confidence: likely

## Files read
packages/editing/src/actions/move/action.ts
packages/editing/src/actions/move/behaviors/clampMove.ts
packages/editing/src/actions/move/behaviors/index.ts
packages/editing/src/actions/move/behaviors/layoutDrop.ts
packages/editing/src/actions/move/behaviors/pageDrop.ts
packages/editing/src/actions/move/behaviors/reparentOnDrop.ts
packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts
packages/editing/src/actions/move/behaviors/snapToContainer.ts
packages/editing/src/actions/move/behaviors/swapOnDrop.ts
packages/editing/src/actions/move/capture.ts
packages/editing/src/actions/move/commit/index.ts
packages/editing/src/actions/move/commit/layoutDrop.ts
packages/editing/src/actions/move/commit/layoutRelease.ts
packages/editing/src/actions/move/commit/pageDrop.ts
packages/editing/src/actions/move/commit/rebase.ts
packages/editing/src/actions/move/commit/reparent.ts
packages/editing/src/actions/move/delta.ts
packages/editing/src/actions/move/dragSnap.ts
packages/editing/src/actions/move/frame.ts
packages/editing/src/actions/move/gestureAdapter.ts
packages/editing/src/actions/move/index.ts
packages/editing/src/actions/move/landedDescendants.ts
packages/editing/src/actions/move/layout/container.ts
packages/editing/src/actions/move/layout/dragged.ts
packages/editing/src/actions/move/layout/dropPass.ts
packages/editing/src/actions/move/layout/exits.ts
packages/editing/src/actions/move/layout/glide.ts
packages/editing/src/actions/move/layout/types.ts
packages/editing/src/actions/move/layout/view.ts
packages/editing/src/actions/move/refusal.ts
packages/editing/src/actions/move/session.ts
packages/editing/src/actions/move/sessionOf.ts
packages/editing/src/actions/move/translate.ts

<!-- done: 1 findings, files read: 33 -->
