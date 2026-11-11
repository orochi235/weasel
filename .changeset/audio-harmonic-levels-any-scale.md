---
"@weasel-js/audio": patch
---

A harmonic wave plays the same wave for levels near either end of the double range as for any others in the same ratio. Levels are scaled to a peak of 1 before use, so a worklet or offline voice no longer renders `NaN` and a node voice's `PeriodicWave` no longer stores `Infinity` or 0.

<!-- entry: rank=-5 fix -->
