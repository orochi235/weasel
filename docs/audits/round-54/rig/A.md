I couldn't write `.skulk/out/findings.md` because the permission was denied, so the whole findings document is below.

# Audit round 54: area `rig`

The checkout's HEAD is 830b463cc1, not the 608f35f5 the brief names. These findings are from this tree.

## Removing a joint leaves `data.joint` bindings naming it, and the next bone drawn reuses the name and takes them over
- where: packages/rig/src/bone/boneActions.ts:45 (commitSkeleton, `strip`) and :140 (bone.remove)
- scenario: A rig has joints `joint`, `joint2` and `joint3`. A child node has `data: { joint: 'joint3' }`, so it rides that joint whole (allowed by `RigNodeData.joint`). Press Delete with `joint3` active. `strip` removes `joint3` from every `skin` under the rig, but the child keeps `data.joint === 'joint3'`, and core reports it as dangling. Now draw a new bone. `addJoint` gives it the first free name, which is `joint3` again, so the child is bound to an unrelated new bone and moves with it. The fix is either to clear `data.joint` for removed joints in the same undo entry, as is already done for skins, or to never reuse a removed name.
- evidence: read. `strip` in boneActions.ts only touches `data.skin`. `addJoint` in animator's skeletonEdits.ts picks the first unused name from `joint`, `joint2`, …. `read()` in core's rigNode.ts binds nodes by their `data.joint` name.
- severity: medium

## The weight brush paints only where the pointer was sampled, so a fast drag leaves gaps
- where: packages/rig/src/weight/weightActions.ts:157 (weight.paint `onMove` → `stroke`)
- scenario: With a 24 px brush, drag quickly across a path so that move events land 80 px apart. `dab` runs only at each sampled point, so points between two samples (outside both 24 px circles) get no weight. The stroke comes out dotted, and how dotted depends on the pointer event rate. It should stamp along the segment from the previous sample to the current one, with spacing no larger than the radius.
- evidence: read. Each `onMove` calls `dab` once at `move.world`, and nothing remembers the previous point.
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

<!-- done: 2 findings, files read: 16 -->