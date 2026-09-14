---
'@weasel-js/theme': patch
---

Three lightness ramp edge cases: a theme whose ramp steps vary by axis now shadows only the inherited pins on steps it declares in every branch, so `derive` no longer throws where a branch omits one; an anchor on a step where the chroma envelope is near zero no longer turns the ramp's other steps gray while a bias moves off 0 (the ramp's chroma still rises steeply there); and a negative `peak`, `lightBias` or `darkBias` is reported as invalid instead of producing `NaN` colors or flipping the hue.
