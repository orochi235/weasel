I couldn't write `.skulk/out/findings.md` because the write permission was declined, so the whole document is below. Commit 608f35f5 isn't in this clone, so I read the working tree at HEAD 830b463cc1 instead; nothing under `packages/rig` has local changes.

# Audit round 54: area `rig`

## Removing a joint strips it from skins but leaves `data.joint` bindings naming it, and a later bone takes them over
- where: packages/rig/src/bone/boneActions.ts:51 (commitSkeleton, `strip`)
- scenario: A rig has joints `joint`, `joint2` and `joint3`, and a child node rides `joint3` whole (`data.joint: 'joint3'`). Deleting `joint3` with the bone tool runs `strip`, which only rewrites `data.skin` (through `dropSkinJoints`). The child keeps `data.joint: 'joint3'`, and `rigFromNode` now reports it as dangling. When a new bone is drawn, `addJoint` gives it the first free name, which is `joint3` again. The child now rides an unrelated new bone. Skins are cleaned on removal to prevent exactly this, so whole-node bindings should be cleared the same way, in the same undo entry. As it stands, the two kinds of binding are handled two different ways.
- evidence: read (core `rigNode.ts` `read()` binds `data.joint` by name; animator's `addJoint` reuses freed names)
- severity: medium

## A weight-brush drag paints only where pointer events land, so a fast stroke leaves gaps
- where: packages/rig/src/weight/weightActions.ts:147 (`weight.paint` onMove → `dab`)
- scenario: With a radius of 24 px, drag across a path fast enough that pointer moves land more than about 48 px apart. Each `onMove` calls `dab` at the event point only, and `brushWeights` checks each point's distance to that single center. Points between two events never get weighted, so the stroke is a row of separate dabs instead of a continuous swath. Nothing keeps the previous point to cover the segment between events.
- evidence: read
- severity: low

## The overlays don't repaint when a consumer-supplied `selection` or `rig` thunk changes
- where: packages/rig/src/useRigTools.ts:53; packages/rig/src/weight/useWeightTool.ts:63; packages/rig/src/bone/useBoneTool.ts:72
- scenario: Call `useRigTools({ scene, selection: () => mySelection })` with a selection held outside the scene. Changing `mySelection` changes which rig `rig()` returns. But the bone and weight overlays only subscribe to the edit state (and to the bone tool's live skeleton). Under the `RenderLayer.subscribe` contract, the canvas only repaints by itself on scene or prop changes. So the overlays keep drawing the old rig's skeleton and weight dots until some unrelated repaint, while clicks already act on the new rig.
- evidence: read (core/src/core/layers/render.ts:100–105)
- severity: low

## Files read
packages/rig/src/actionParamSchema.ts
packages/rig/src/bone/boneActions.ts
packages/rig/src/bone/boneOverlay.ts
packages/rig/src/bone/placedRig.ts
packages/rig/src/bone/rigEditState.ts
packages/rig/src/bone/useBoneTool.ts
packages/rig/src/icons.gen.ts
packages/rig/src/icons.table.ts
packages/rig/src/index.ts
packages/rig/src/kitSettings.ts
packages/rig/src/pbt.fixture.ts
packages/rig/src/toolSets.ts
packages/rig/src/useRigTools.ts
packages/rig/src/weight/useWeightTool.ts
packages/rig/src/weight/weightActions.ts
packages/rig/src/weight/weightOverlay.ts

<!-- done: 3 findings, files read: 16 -->