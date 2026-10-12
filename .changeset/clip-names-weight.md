---
'@weasel-js/animator': patch
---

Adds API: a clip can name a track's weight. `ClipSampledTrack.weight` takes a name as well as a number, `weight: 'fade'`, and `bindClip` asks the new `ClipBinder.weight(name)` for the function it stands for, read each frame as a function `weight` on a live track is. That is what a crossfade between clips needs: the clips stay data and the fade is the binder's. The live track keeps the name in the new `SampledTrack.weightName`, and `toClip` writes it back; a function weight with no `weightName` still throws. `bindClip` throws on a name the binder does not resolve.
