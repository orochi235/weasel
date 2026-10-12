---
'@weasel-js/core': patch
---

A rig is an animation target, and `blendPoses` is removed. Breaking for anything that called `blendPoses`.

`Rig.target` is a `Target<Pose>`: its committed value starts as `{}`, the bind pose, and each frame the rig is posed with what the target shows. A clip is a `SampledTrack<Pose>` with `target: rig.target`. Two clips on one rig crossfade by their `weight`s, weights that sum to less than 1 leave the rest to the committed pose, and a `spring` or `tween` on the target adds on top. `rig.pose(pose, root)` still writes at once, and now commits `pose` as well. `rig.place(root)` sets the root transform without a pose; a `pose` called with no `root` keeps the last one given, where it used to drop it.

`skeletonAxes(skeleton)` is the axes a pose target uses: five per joint in skeleton order, every rotation an angle. Pass it to `createTarget` for a pose target that is not bound to scene nodes.

A `SampledTrack` with a `target` no longer needs `interpolate` for a value that is not plain numbers. It is sampled in the target's axes, the short way round between neighboring keys on an angle axis, and every sample, a key's own included, is a value the axes built. An `interpolate` or `interpolator` on the track still wins.

What replaces each use of `blendPoses`:

- **A track's `interpolate`** (`blendPoses([a, b], [1 - u, u])`): give the track `target: rig.target` and drop `interpolate`.
- **Blending poses by weight**: `animator.hold({ target: rig.target, value: pose, weight })`, one per pose.
- **Weighting IK against animation** (`blendPoses([anim, solved], [1 - w, w])`): hold the solved pose at `w` beside the clip at `1 - w`.
- **A blended pose as a value**: `sampleTrack` on a targeted track whose two keys are the poses.

Where the result differs from `blendPoses`:

- Weights are not normalized. `[0.3, 0.3]` is an even mix at 60% strength over the committed pose; weights summing past 1 share full strength, so `[1, 1]` is still an even mix.
- Rotation takes the short way round from the committed pose, not between the poses. Two held rotations more than half a turn apart through the committed one, such as 3 and -3 over a bind pose at 0, meet on the committed side.
- A pose read back names every joint of the skeleton in full.

Also fixed: a frame the animator requested from inside its own ticks ran ahead of the paint a canvas requests from `onTick`, which cost one painted frame each time a track took hold of its target or an `onDone` started another animation. The request now waits until after `onTick`.
