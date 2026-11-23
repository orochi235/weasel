---
'@weasel-js/core': patch
---

`stableStringify` writes `NaN`, `Infinity`, and `-Infinity` as tags of their own, so none of them reads as `null` or as each other.

<!-- entry: fix -->
