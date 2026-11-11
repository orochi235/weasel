---
"@weasel-js/guides": patch
---

`nearestWithin` rejects every drop under a negative tolerance, which it squared, so `-5` accepted a target within 5 and `-Infinity` one anywhere.
