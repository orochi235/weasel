# Audit round 68 — symmetry

## A repeat's guide line points away from its copies when its spacing is negative
- where: packages/symmetry/src/guide.ts:164 (createSymmetryGuideLayer draw, `repeat` branch)
- scenario: a repeat group whose `spacing` is negative (e.g. `-120`, which `symmetrySpecOf` keeps as-is and which the kinds table steps with, `dx = cos(angle) * spacing`): its copies and the step dots fall on the `angle + π` side of the center, and the step handle sits there too (`along('step', angle, spacing)`). But the faint repeat line is drawn as a half-line from the center toward `angle` (`across(spec.angle, faint, true)`), which is the side with no copies. The half-line should follow the sign of `spacing`, i.e. go toward `angle + π` when `spacing < 0`.
- evidence: read
- severity: low

## The angle knob can sit on a nested symmetry group's copies, though the guide says it clears the contents
- where: packages/symmetry/src/frames.ts:52 (reachFrom), used by packages/symmetry/src/controller.ts:156
- scenario: a mirror group holds a nested radial or repeat group whose copies reach farther from the outer center than its authored children. `reachFrom` only walks authored descendants' drawn boxes and ignores the copies any nested group draws. So `reach` comes out too small, and the knob (`guideHandles`, placed past `reach`) ends up on top of a drawn copy. A press there takes the knob instead of starting a stroke on the shape, which is the case the knob placement is meant to prevent. Only a nested group's turn/reflect copies stay within the outer reach, and only when they share the outer center.
- evidence: read
- severity: low

## Bake builds copies from the 'document' world pose while the live copies, the guide and edits use 'shown'
- where: packages/symmetry/src/bake.ts:84 and :131 (bakeInBatch / copySubtree) vs packages/symmetry/src/group.ts:134 (symmetryOf)
- scenario: in a scene where a node's shown pose differs from its document pose (a scroll offset of a scrolling container held above the group, which `buildSceneTree` applies through `scrolled(...)`), `symmetryOf`/`editSymmetries`/the guide put the center at the shown position. `bakeInBatch`, though, calls `copiesFromPose(worldPoseOf(scene, id, 'document'))` and carries the leaves' 'document' world poses. So the same group is answered in two spaces: the copies bake rotates/reflects about a different center than the guide shows, and the baked copies land off where the live ones drew. Bake should read the center in the same space the renderer passes to `copiesFromPose`.
- evidence: read (the space the renderer passes was not traced end to end)
- severity: low

## Files read
packages/symmetry/src/bake.ts
packages/symmetry/src/controller.ts
packages/symmetry/src/frames.ts
packages/symmetry/src/group.ts
packages/symmetry/src/guide.ts
packages/symmetry/src/handleDrag.ts
packages/symmetry/src/index.ts
packages/symmetry/src/kinds.ts
packages/symmetry/src/pbt.fixture.ts
packages/symmetry/src/settings.ts
packages/symmetry/src/wallpaper.ts

<!-- done: 3 findings, files read: 11 -->
