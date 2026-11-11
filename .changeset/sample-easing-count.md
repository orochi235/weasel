---
"@weasel-js/ui": patch
---

`sampleEasing` gives no samples for a negative or non-finite count and the whole count below a fractional one, where it threw a `RangeError`.
