---
'@weasel-js/theme': patch
---

Three lightness ramp edge cases: a theme whose ramp steps vary by axis now shadows only the inherited pins on steps it declares in every branch, so `derive` no longer throws where a branch omits one; an anchor on a step where the chroma envelope is near zero no longer sends the ramp gray or suddenly vivid as a bias moves off 0; and a negative `peak`, `lightBias` or `darkBias` is reported as invalid instead of producing `NaN` colors.
