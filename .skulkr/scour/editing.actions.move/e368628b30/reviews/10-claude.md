# Findings: editing.actions.move

## landedDescendantOps translates descendants' world poses by a delta measured between stored poses
- where: packages/editing/src/actions/move/landedDescendants.ts:35 (landedDescendantOps)
- scenario: `dx, dy` come from `d.getBounds(from)` and `d.getBounds(to)`, where `from` and `to` are the root's stored poses (the transform op's args, rebased into the root's parent frame by `rebaseTransformOp`). `carriedDescendants` then applies that delta to each descendant's **world** pose (`translate(composeWorldPose(...))`, carryDescendants.ts:53). Under a turned or scaled parent frame, a stored delta and a world delta point different ways. Example: an envelope group (no frame of its own) inside a layout container turned 90°, reordered by a layout drop so its stored pose moves +100 in x. That is +100 in y in world, but its children are moved +100 in x in world, so they come apart from the group. The same happens when a root is reparented into a turned or scaled container (layout drop, or snapToContainer's slotted roots, whose children are not routed through `keptInPlace`). Expected: the delta comes from the root's world poses before and after, as `reflowCarry` in dropPass.ts:150 does.
- evidence: read (carryDescendants.ts:37-62 confirms the world-space translate)
- severity: medium
- fix: packages/editing/src/actions/move/landedDescendants.ts
- size: function
- cause: stored-frame delta applied in world
- confidence: likely

## landedDescendantOps measures a root caught mid-glide from its shown pose, so its descendants land off by the glide offset
- where: packages/editing/src/actions/move/landedDescendants.ts:30 (landedDescendantOps)
- scenario: `from` is `startPoses.get(id)` first. For a root caught mid-glide, `captureStartPoses` records `effectivePose`, which is the shown pose: the document pose plus the caught offset `c`. The descendants that `carriedDescendants` moves start from their document poses. So when a layout drop or a behavior places an envelope root that was grabbed mid-reflow, its descendants move by `landed − (doc + c)` and end up `c` short of where the root's offset puts them. `translateOps` makes up for `c` explicitly (translate.ts:20). This path does not.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/landedDescendants.ts
- size: line
- cause: shown pose used as document start
- confidence: likely

## reparentOnDrop 'above' lands several roots in reverse order; 'append' keeps their order
- where: packages/editing/src/actions/move/commit/reparent.ts:68 (landAbove), used at reparent.ts:173 (reparentOps) and pageDrop.ts:155 (pageDropOps)
- scenario: dropping roots [A, B] in `'above'` mode over sibling H: A goes in at index(H)+1, which gives [H, A]. B then goes in at index(H)+1 as well, which gives [H, B, A]. B ends up painted below A. In `'end'`/append mode the same roots land as [A, B]. So the relative z-order of a multi-root drop flips depending on the mode. Expected: each later root lands just above the root placed before it.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/commit/reparent.ts
- size: function
- cause: each root anchored to hitSibling, not the previous landing
- confidence: sure

## snapBackOrDelete records a flat index across all nodes as each root's sibling index
- where: packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts:62 (onStart), consumed at :87-93 (onEnd)
- scenario: `indexes` is `adapter.getNodes().findIndex(...)`, a position in the flat list of every node. `ops.delete`'s `index` is the ordinal among the node's siblings (delete.ts:28 "Sibling ordinal"). For a nested root, or a root after another tree's descendants, the recorded index is too large. It is only a seed that apply re-observes, but the "topmost first" sort of several roots also uses these flat positions. For roots under different parents that order means nothing, and a slot the adapter cannot observe falls back to the wrong index on undo.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts
- size: line
- cause: flat node index used as sibling ordinal
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

<!-- done: 4 findings, files read: 33 -->
