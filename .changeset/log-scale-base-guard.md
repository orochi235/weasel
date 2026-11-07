---
'@weasel-js/plot': patch
---

`logScale` throws on a `base` that is 1, not above zero, or not finite, as `powScale` throws on an exponent of zero. It used to build a scale that mapped every value to `NaN` and ticked none.
