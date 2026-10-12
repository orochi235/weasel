---
'@weasel-js/animator': patch
'@weasel-js/core': patch
---

Adds API: a hold or a timeline track names the axes it holds. `HoldOptions.axes` and `SampledTrack.axes` take a name wherever they took an index: a plain object's field, `animator.hold({ target, value, axes: ['y'] })`, a rig's joint, `axes: ['armL']`, or one axis of a joint, `axes: ['armL.rotation']`. Names are typed against the target's value where it has fixed fields, and one the target has no axis for throws as the hold starts.

A target's axes carry the names: `TargetAxes.names` is one name per axis, where a dot makes a path that a shorter name reaches as a whole. `axesOf` names a plain object's axes by its fields and `skeletonAxes` names a pose's `<joint>.<field>`; axes written by hand name theirs by setting `names`. `target.axisIndexes(['y'])` answers the indexes for a caller that wants the numbers, and `jointAxes` goes through the same lookup. `AxisName` and `AxisRef` are the types.

Adds API: the stagger builder moves targets. `.tween` and a new `.spring` move each item where the items are targets, `animator.stagger(targets, 80).spring({ to: (target) => ..., preset: 'wobbly' })`, or the target a `target` option names for the item, one for them all or a function of the item. Both keep the form that hands values to `onTick`, and `.tween` there takes an `interpolator`. The option types are `StaggerTargetTweenOptions`, `StaggerTargetSpringOptions`, and `StaggerSpringOptions`.

Breaking, within this unreleased surface: a clip's axis names no longer go through the binder. `ClipBinder.axes`, `SampledTrack.axisNames`, and `sceneClipAxes` in `@weasel-js/core` are gone, since a rig's target answers its own joint names; drop `axes` from a binder and a clip naming joints plays as before. `bindClip` now also throws on a numeric axis out of the target's range, where that used to wait for the playhead to reach the track.
