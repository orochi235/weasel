# Audit round 55: symmetry findings

## A group's center is read in the shown world but written back through the document world, so a group in a scrolled container moves by the scroll offset
- where: packages/symmetry/src/group.ts:135 (symmetryOf); packages/symmetry/src/controller.ts:89 (write, via centerUnder, then localPoseUnder in frames.ts:9)
- scenario: a symmetry group sits under a container scrolled by (0, 200). `symmetryOf` reads the center with `worldPoses(scene, 'shown')`, which goes through `viewPoseAdapter` and adds the scroll offset. `write` turns a world center back into a stored one with `localPoseUnder`, which rebases through `scenePoseAdapter`, the document reading with no scroll. So `ctrl.update(id, { center: ctrl.read(id).center })` moves the group 200 down when it should do nothing. The handle drag does exactly this. `origin.center` comes from `ctrl.read`, and `back = { center: origin.center }` is previewed at every end. An unmoved press writes `{ center: origin.center }`. So pressing and releasing any handle, or canceling a drag, shifts the group by the scroll offset, which contradicts the 2026-11-10 ruling that a handle dropped where it was pressed changes nothing. Every center drag also lands offset by the scroll. `reachFrom` (frames.ts:44) measures the children in the document reading against the shown center, so the knob distance is wrong there too. Reads and writes should go through one reading, for example `scenePoseFrame(scene).world` and `.localUnder`.
- evidence: read (core/src/interactions/actions/poseFrame.ts:80-123: 'shown' uses viewPoseAdapter; 'document' and the rebase use scenePoseAdapter)
- severity: medium

## The controller never listens to the scene, so an undo, a redo or an outside edit of the active group leaves subscribers and the guide stale
- where: packages/symmetry/src/controller.ts:73-128 (createSymmetry); the guide subscribes at :136
- scenario: `subscribe` promises "Hear that the active group, or anything about it, changed", and `active()` answers null "once that group is gone, an undone create say". But `notify` fires only from `setActive`, `update`, `preview` and `bake`, and nothing subscribes to the scene. Undo a "Change symmetry" step, undo the create, or move the group's children (which changes `reach`), and no listener hears it. An app panel showing the active group's kind or count keeps the old values, or keeps showing a deleted group. The guide layer, whose `subscribe` is `ctrl.subscribe`, gets no redraw request from this source. The controller should subscribe to the scene's changes to the active group and its subtree, and notify.
- evidence: read
- severity: medium

## The wallpaper guide draws a dot at every lattice point, but copies are drawn only at the nearest few when the cell is large
- where: packages/symmetry/src/guide.ts:199 (latticeGuide) vs packages/symmetry/src/kinds.ts:152-153 (wallpaper transforms)
- scenario: p6m (a kaleidoscope cell with count 6: 11 cell copies plus the identity, 12 per point) caps the lattice at floor(4097/12) = 341 points nearest the center. `latticeGuide` calls `latticePoints(spec)` with the default limit of 4097. With a small spacing and a large extent, the guide shows about 4097 lattice dots while copies appear at only 341 of them, so the outer dots promise copies that are never drawn. The same decision (which points draw) is answered two ways. The guide should use the same limit as the transforms.
- evidence: read
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
