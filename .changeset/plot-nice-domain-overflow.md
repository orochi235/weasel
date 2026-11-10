---
'@weasel-js/plot': patch
---

`niceDomain`, and a `linearScale` with `nice`, keep an end where its whole step would overflow, so a domain reaching
near `Number.MAX_VALUE` no longer widens to infinity and maps every value to `NaN`; a span too fine for its step to
cut, such as `[0, 5e-324]`, is kept as given rather than collapsed to one point.
