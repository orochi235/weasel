---
'@weasel-js/ui': patch
---

`TokenPanel` no longer rewrites a token when its number field is focused and left untouched. The fields show four decimal places and commit what they show on blur, so clicking into a token valued `0.33333rem` and tabbing out changed it to `0.3333rem` and marked it overridden. A commit that reads the same as the current value at the field's precision is now ignored, for token values and for a scale's base, ratio, and step.
