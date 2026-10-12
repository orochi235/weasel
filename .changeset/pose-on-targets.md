---
'@weasel-js/core': patch
---

Two moves on one node now combine. `tweenPose`, `springPose`, `animateOnSetPose`, `animateLifecycle`, the reflow glide, and `momentum` move the node's pose target, where they used to each write a pose every frame and the last writer won.

**This changes behavior on a scene-backed adapter** (`sceneToAdapter`, `useSceneAdapter`, the one `<SceneCanvas>` builds):

- `tweenPose` and `springPose` write the destination to the scene as the move starts. The scene's pose is the destination for the whole move, and the node on screen travels there through `scene.overrides`. `setPose` is no longer called each frame, so the scene's version and history do not change per frame. Read the pose on screen with `effectivePose(scene, node)`.
- A second `tweenPose` on a node no longer cancels the first. Both run under `pose:<id>` and add. `springPose` interrupts every move on its node and starts at their combined velocity.
- Canceling a move leaves the scene at the pose the node was shown at, not at the destination.
- A move undone mid-flight ends there: at the next frame the node shows the undone pose and nothing is left running. The same goes for anything else that writes a node's pose while it is moving.
- `target.stop({ commit? })` stops every animation on a target. By default each commits where it was; `commit: false` leaves the committed value as it stands.
- `animateOnSetPose`: the scene takes each written pose at once. A second write to a node mid-glide bends the glide (or, with `spring`, carries its velocity) where it used to end the glide and snap.
- `animateLifecycle`: the enter pose is shown and never written, and a node shrunk out is removed at the pose it had, so undoing the removal restores it whole.
- Reflow glides: a timed retarget adds to the glide still running, and no longer restarts from the pose on screen. A `spring` retarget keeps the node's velocity.
- `momentum` coasts on the node's pose target. The document still takes the flick as one transform when it comes to rest.

An adapter without `poseTarget`, and a pose its descriptor gives no axes for, behave as before: `setPose` each frame, and a new move cancels the one running. `pathPoseDescriptor` and `AUTO_POSE_DESCRIPTOR` give a `Path` pose axes, a polygon's being its coordinates, so a path moves on its target between two shapes with as many points.

A container under `cascadeContainerPose` moves on its target too. Its descendants' poses are written with it as the move starts, and each is shown traveling beside it through an override of its own; `scenePoseTarget` takes a `cascade` (`PoseCascade`) that says how.

New API:

- `createPoseTarget({ id, get, set, overrides, descriptor? })` makes the target for one node's pose, and `scenePoseTarget(scene, id, descriptor?)` returns the one a scene keeps per node. Animations given it as `target` add to everything else moving that node.
- `SceneAdapter.poseTarget?(id, descriptor?)` is how an adapter hands that target to the helpers.
- `PoseDescriptor.axes?(like)` says how a pose maps to numbers and which are angles. `RECT_POSE_DESCRIPTOR` maps `x`, `y`, `width`, `height`, and `rotation` as an angle, so a rotation tweens the short way round.
- `interrupt: false` on a targeted `tween`, `spring`, `physics`, or `decay` takes a `cancelKey` without canceling the animations holding it.
- `publish` on `createTarget`: called once a frame for all the targets sharing it. A target's `show` is now also called as an animation starts on it.
- `tweenPose` takes `from`, where the move appears to start. `tweenPose` and `springPose` accept any adapter with `getPose` and `setPose` (`PoseAnimationAdapter`), so the adapter from `useSceneAdapter` needs no cast.
