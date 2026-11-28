## Move records a "translate by the drag delta" for Transform Again whatever the commit actually did
- where: packages/editing/src/actions/move/action.ts:85 (moveAction invoker onEnd)
- scenario: any committed move whose ops are not a plain translate by `frame.delta` (a `swapOnDrop` swap, a `snapBackOrDelete` release with `onFreeRelease: 'delete'`, a layout drop that lands the node in a slot, or a `snapToContainer` plant of a node with its own slot) still calls `recordTransform(scene, { kind: 'translate', ...frame.delta }, subject)`. Transform Again then repeats a translate by the pointer delta: after a swap it slides the selection by the drag distance rather than repeating anything the user did; after a delete it remembers a translate for nodes that no longer exist; and it can fold into a preceding `duplicate` memory (memory.ts:60) and corrupt that step's offset. Should be: only record when the commit was the default translate (`answer === undefined` in `commitMove`), or have `commitMove` report what kind of commit landed.
- evidence: read (action.ts onEnd; commit/index.ts commitMove; core transform-again/memory.ts recordTransform)
- severity: medium
- fix: packages/editing/src/actions/move/action.ts, packages/editing/src/actions/move/commit/index.ts
- size: function
- cause: commit outcome reduced to a boolean; kind of commit lost
- confidence: likely

## A root landed by a layout drop or a `snapToContainer` slot moves its envelope descendants by a local-coordinate difference across two frames
- where: packages/editing/src/actions/move/landedDescendants.ts:33 (landedDescendantOps)
- scenario: `from` is the root's start pose stored under its old parent and `to` is its pose stored under the new parent (layoutDropOps rebases commitDrop ops under the destination; snapToContainer's plantOps writes `toLocalUnder(snap.parentId, slot)`). The descendants are shifted by `to − from` in stored coordinates. When the root does not define its own frame, those descendants are stored in the frame above it, which the reparent changes; with a destination that is scaled or rotated relative to the source (a layout container under a scaled group), each child keeps its old *local* offset from the root, so its world offset is scaled/rotated and the subtree visibly deforms on drop. The reparent-on-drop and page-drop paths answer the same question differently: `landedCascadeOps` (commit/reparent.ts) and snapToContainer's own `keptInPlace` for slotless roots rebase every rider to keep its world place. Should: route these riders through the world-preserving rebase too.
- evidence: read (landedDescendants.ts, commit/layoutDrop.ts, behaviors/snapToContainer.ts plantOps vs keptInPlace, commit/reparent.ts landedCascadeOps)
- severity: low
- fix: packages/editing/src/actions/move/commit/layoutDrop.ts, packages/editing/src/actions/move/behaviors/snapToContainer.ts
- size: function
- cause: delta taken between poses stored in different frames
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

<!-- done: 2 findings, files read: 33 -->
