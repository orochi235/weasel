# Findings: editing.actions.move

## A root reparented by a layout drop or a snap slot carries its envelope descendants by a stored-pose delta that mixes the old and new parent frames
- where: packages/editing/src/actions/move/commit/layoutDrop.ts:44 (layoutDropOps), packages/editing/src/actions/move/behaviors/snapToContainer.ts:197 (plantOps, slotted loop)
- scenario: Drag a group whose pose is not a frame (an envelope: its children are stored in its parent's frame), and drop it into a layout container, or a `snapToContainer` slot, whose frame is turned or scaled. These paths write only the root's ops: a `transform` from its old-parent-local pose to a pose local to the destination. `commitMove` then runs `landedDescendantOps`, which moves every non-carried descendant by `to.bounds − from.bounds` of the root. Those two boxes are in different frames, so under a turned/scaled destination the delta is not the world motion. The descendants are left in the old frame's numbers shifted by that delta, and land away from the group, rotated wrong. The other landing paths do this properly: `reparentOps`, page drops and layout exits use `landedCascadeOps`, and the unslotted roots in `plantOps` use `keptInPlace`, which rebase each descendant through world. So the same question gets two answers, and one of them is wrong under any non-translation frame.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/commit/layoutDrop.ts, packages/editing/src/actions/move/behaviors/snapToContainer.ts
- size: function
- cause: delta between poses in two different frames
- confidence: likely

## A drop of several roots in `reparentOnDrop: 'above'` mode reverses their relative z-order
- where: packages/editing/src/actions/move/commit/reparent.ts:61 (landAbove), used at reparent.ts:174 (reparentOps) and commit/pageDrop.ts:153 (pageDropOps)
- scenario: Select A and B, with A painted below B and in `outer` order [A, B], and release them over sibling H with mode `'above'`. A lands at H's index + 1. Then B lands at H's index + 1 again, which puts B between H and A. The result is H, B, A, so A now paints above B. Every root after the first goes directly above the hit node, beneath the roots placed before it. The roots end up in reverse iteration order, and that order is the selection's order, which is never compared with their paint order. They should keep their relative stacking, just above H.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/commit/reparent.ts, packages/editing/src/actions/move/commit/pageDrop.ts
- size: function
- cause: each root inserted at a fixed index above the hit
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
