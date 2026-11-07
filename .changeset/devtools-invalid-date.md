---
'@weasel-js/core': patch
---

The devtools panel shows an invalid `Date` in a node's data as `Invalid Date`. Asking for such a node failed the whole request with a `RangeError`.
