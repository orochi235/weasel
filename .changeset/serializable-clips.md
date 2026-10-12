---
'@weasel-js/animator': patch
'@weasel-js/core': patch
---

Adds API: a timeline can be saved and loaded. A `Clip` is a timeline as data: `{ version: 1, tracks, duration? }` with keys, easings by built-in name or bezier points, and names wherever a live timeline holds a function or a target. `bindClip(clip, binder)` answers the `{ tracks, duration }` `animator.timeline` takes, resolving each sampled track's `target` and `interpolate` and each event's `name` through the binder, and throws on a name the binder does not know. `toClip({ tracks, duration })` reads a live timeline back into a clip, `handle.tracks()` included, so an animation changed in `<AnimatedTimeline>` can be saved.

A live track now says what it is as well as what it does: `SampledTrack` has `targetName` and `interpolateName`, and `TimelineEvent` has `name` and `data`. `bindClip` sets them and a track written by hand can set them too. `toClip` throws, naming the track, on what a clip cannot hold: a target or `interpolate` with no name, an `onTick`, an `interpolator`, a function for `weight`, a function easing that is not a built-in, or a value JSON would not read back, such as a typed array.

In `@weasel-js/core`, `sceneClipTargets(scene, { rigs })` is a binder's `target` for a scene: `pose:<node id>` is that node's pose target and `rig:<name>` the target of the rig given under that name.
