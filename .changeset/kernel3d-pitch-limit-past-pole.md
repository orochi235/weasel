---
"@weasel-js/kernel3d": patch
---

`clampCamera`, `orbitBy` and `dollyBy` hold pitch inside ±`MAX_PITCH` whatever `minPitch` and `maxPitch` they are given.

<!-- entry: fix -->
