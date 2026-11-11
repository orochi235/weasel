---
"@weasel-js/core": patch
---

`moveEachOps`, which Align and Distribute commit through, returns no ops when any pose it would write leaves the double range, so such an align or distribute is disabled with `NotApplicable` and moves nothing. An align beside a turned node near the double range wrote infinite and `NaN` positions.
