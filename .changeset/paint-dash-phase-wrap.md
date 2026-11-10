---
"@weasel-js/paint": patch
---

`dashPhase` answers a phase below the pattern's cycle, as it promises, for a phase just below zero: `dashPhase([1, 2], -1e-17)` is now 0, where it was 3, the cycle itself.
