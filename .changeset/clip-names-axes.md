---
'@weasel-js/animator': patch
'@weasel-js/core': patch
---

Adds API: a clip can name the part of a target a track holds. `ClipSampledTrack.axes` takes names as well as numbers, `axes: ['armL', 'foreL']`, which the track's target resolves against its own axes, so a track over some of a rig's joints holds the same joints after the skeleton's joint order changes. The live track carries the names as its `axes`, and `toClip` writes them back. `bindClip` throws when a track names axes and has no target, or names one its target does not have.

Numbers go on working as positions in the target's axes, for a target that has no names, and a clip written with them binds as before.
