---
'@weasel-js/theme': patch
---

A lightness ramp's `chroma` takes `lightBias`, which lifts the first step's chroma off zero as `darkBias` lifts the last: the envelope is now `sin(πt) + lightBias·(1−t) + darkBias·t`. It defaults to 0, so existing ramps are unchanged. Without it, a ramp anchored on one brand color with `darkBias` 0 came out gray at both ends.
