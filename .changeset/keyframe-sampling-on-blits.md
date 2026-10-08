---
'@weasel-js/core': patch
---

`sampleTrack` and timeline keyframe tracks compute their values with blits, the same engine tweens and springs run on. A track of number arrays or numeric objects no longer needs an `interpolate`, and keys whose shapes differ throw. A `segmentCache` handed a different track or a replaced `keys` array rebuilds instead of answering for the old one. Edits to keys must go through `timeline.edit` (or a dropped `segmentCache`) to take effect, which numeric tracks used to get away without.
