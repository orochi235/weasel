---
"@weasel-js/ui": patch
---

`sampleEasing` gives no samples for a negative or non-finite count, and the whole count below a fractional one, rather than throwing.

<!-- entry: rank=-5 fix -->
