---
"@weasel-js/kernel3d": patch
---

`clampCamera`, `orbitBy`, and `dollyBy` hold pitch inside ±`MAX_PITCH` whatever limits they are given, as `OrbitLimits` says. A `minPitch` past the upper pole, or a `maxPitch` past the lower one, put the pitch past the pole, where `lookAt` degenerates.
