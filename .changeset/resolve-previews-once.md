---
'@weasel-js/core': patch
---

`resolvePreviews` lists a previewed node once when a previewed frame above its unpreviewed parent carries it, so its ghost is painted once rather than twice.

<!-- entry: fix visual -->
