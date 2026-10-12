---
'@weasel-js/animator': patch
'@weasel-js/core': patch
---

Adds API: a clip can name the part of a target a track holds. `ClipSampledTrack.axes` takes names as well as numbers, `axes: ['armL', 'foreL']`, and `bindClip` asks the new `ClipBinder.axes(target, names)` for the positions they stand for, so a track over some of a rig's joints holds the same joints after the skeleton's joint order changes. The live track keeps the names in the new `SampledTrack.axisNames`, and `toClip` writes them back in place of the numbers. `bindClip` throws when a track names axes and has no target, or when the binder has no answer for them.

Numbers go on working as positions in the target's axes, for a target that has no names, and a clip written with them binds as before.

In `@weasel-js/core`, `sceneClipAxes(rigs)` is a binder's `axes` for the rigs `sceneClipTargets` is given: on a `rig:<name>` target the names are joints, resolved against that rig's skeleton as `jointAxes` does.
