# Audit round 66 — core.animation (reviewer findings)

## A write that animateOnSetPose passes straight through leaves a running no-poseTarget glide on, which writes over it next frame
- where: packages/core/src/animation/wrappers/animateOnSetPose.ts:62 (setPose)
- scenario: adapter without `poseTarget`; `setPose(id, A)` starts a fallback tween (writes `setPose` every tick). Then a write the wrapper skips — `skipDuringGesture` with `id` in `gestureScope` (a drag picks the node up mid-glide), a `shouldAnimate` returning false, or a write from inside another animation's tick (`animator.isTicking()`) — goes to `adapter.setPose(id, pose)` and returns at lines 62–65 / 69–72, before the `cancelKey(poseKey(id))` at line 75. The old tween's next `onTick` writes its interpolated pose over the new one, and when it ends the node sits at `A`, not at the pose just written. The drag fights the glide for its remaining duration. The doc says that over an adapter with no `poseTarget` "a second write ends the glide: the new pose is written at once and stands"; only the animated branch does that. Should cancel `poseKey(id)` on the pass-through paths too (no-poseTarget case).
- evidence: read
- severity: medium

## Baking a skinned node writes its world-space bent path into `data.path`, so a rotated node gets its rotation applied twice
- where: packages/core/src/animation/rig/skinBinding.ts:88 and :99–100 (bindSkins show / write)
- scenario: a skinned path node whose pose has `rotation` (or a `transform`). `rest` is `dataRestPath` = `pathInWorld(data.path, pose)`, a world path, so `skinPath` returns a world path. `show` sets `entry.pose = descriptor.fromBounds(boundsOfPath(path), restPose)`, keeping `restPose`'s rotation around the world AABB; `write` stores that world path as `data.path` with that pose. `kit:path` draws `data.path` through `pathInWorld` → `pathInPoseBox` (identity, box = path AABB) then `poseFrameOf(pose)` rotates it again about the box center. After `rig.bake()` the node is drawn rotated by its rotation a second time, and the next `dataRestPath` read compounds it. While showing, the override's `path` is drawn as-is but the override pose (world AABB plus rotation) is what picking/bounds see, so the pick box is off by the same rotation. Should go through `worldEditToStorage(restPose, path)`, which is the inverse `pathInWorld` was given for exactly this.
- evidence: read (pathInWorld/pathInPoseBox in packages/geom/src/paths/pathInWorld.ts:36–68); that `fromBounds` keeps rotation is inference from its `(bounds, template)` shape
- severity: medium

## animateLifecycle re-inserting a node whose exit is still running inserts a node the scene still holds
- where: packages/core/src/animation/wrappers/animateLifecycle.ts:48–49 (insertNode)
- scenario: `removeNode(id)` with `exitTo` set starts the exit tween; the node stays in the scene until `remove` runs. Calling `insertNode(node)` for the same id before that ("A node back before its exit ended stays") runs `callOff` — which cancels the exit and restores the pose, leaving the node in place — and then still calls `adapter.insertNode(object, index)`. Over a scene-backed adapter that is `scene.add` with an id already present, which throws on the collision (`packages/core/src/canvas/sceneAdapter.ts:256–258`); over a plain store it duplicates the node. When `leaving` held the id, the inner insert should be skipped (or the node updated), not repeated.
- evidence: read (the throw on id collision is per the sceneAdapter comment, not run)
- severity: medium

## placeSkeleton / unplaceSkeleton place root joints by the pose's full frame but turn them by the descriptor's rotation only
- where: packages/core/src/animation/rig/rigNode.ts:71–79 and :90–98 (placeSkeleton, unplaceSkeleton)
- scenario: a rig node whose pose carries a `transform` (a mirror, or a skew/scale) or whose descriptor's `getRotation` reads something other than what `poseFrameOf` composes. Root joint positions go through `poseFrameOf(pose)` (rotation and `transform` about the AABB center) while their `rotation` gets only `descriptor.getRotation(pose)`. A mirrored rig node puts its joints at mirrored positions with unmirrored angles, so the limbs point the wrong way; with a custom descriptor the two answers for "how is this node turned" can disagree outright. One pathway should answer both (the frame's linear part for the angle, or the descriptor for both).
- evidence: read; the visible mismatch under a mirrored `transform` is inference
- severity: low

## Files read
packages/core/src/animation/behaviors/coast.ts
packages/core/src/animation/behaviors/coastByWrite.ts
packages/core/src/animation/behaviors/coastOnTargets.ts
packages/core/src/animation/behaviors/momentum.ts
packages/core/src/animation/clipTargets.ts
packages/core/src/animation/departures.ts
packages/core/src/animation/index.ts
packages/core/src/animation/motionMs.ts
packages/core/src/animation/pathMotion.ts
packages/core/src/animation/poseHelpers.ts
packages/core/src/animation/poseTarget.ts
packages/core/src/animation/poseTransition.ts
packages/core/src/animation/reflow.ts
packages/core/src/animation/reflowGlide.ts
packages/core/src/animation/rewind.ts
packages/core/src/animation/rig/bindRig.ts
packages/core/src/animation/rig/index.ts
packages/core/src/animation/rig/rigNode.ts
packages/core/src/animation/rig/rigSeat.ts
packages/core/src/animation/rig/skinBinding.ts
packages/core/src/animation/rig/useRig.ts
packages/core/src/animation/wrappers/animateLifecycle.ts
packages/core/src/animation/wrappers/animateOnSetPose.ts
packages/core/src/animation/wrappers/index.ts
packages/core/src/animation/wrappers/instantPose.ts
packages/core/src/animation/writtenPoseTarget.ts

<!-- done: 4 findings, files read: 26 -->
