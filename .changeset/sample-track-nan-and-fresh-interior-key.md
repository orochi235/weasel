---
'@weasel-js/core': patch
---

`sampleTrack` at a `NaN` time returns the first key's value again, where it had started returning `NaN` (and threw for a track of values it cannot lerp). At an interior key's exact time, a track with its own `interpolate` or `interpolator` now returns a value made by that function at 0 instead of the key's own object, so changing a sampled value no longer changes the key.
