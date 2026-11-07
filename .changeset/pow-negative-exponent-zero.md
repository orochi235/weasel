---
'@weasel-js/plot': patch
---

`powScale` throws on a negative exponent over a domain that reaches zero, as `logScale` throws on a domain not above zero. It used to build a scale that mapped and inverted every value to `NaN`.
