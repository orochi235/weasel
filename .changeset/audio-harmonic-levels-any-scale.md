---
"@weasel-js/audio": patch
---

A harmonic wave's levels are scaled to a peak of 1 before use, so levels near either end of the double range play the same wave as any others in the same ratio: a worklet or offline voice no longer renders `NaN`, and a node voice's `PeriodicWave` no longer stores them as `Infinity` or 0.
