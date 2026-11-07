---
'@weasel-js/animator': patch
---

A tween on a target given `interpolate` or `interpolator`, played backward to its start while a hold or another animation still moved the target, left the target off its start by the last frame's step, for good where nothing else asked for a frame.
