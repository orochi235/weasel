---
'@weasel-js/core': patch
---

`momentum()` throws a `RangeError` on a `friction` outside (0, 1), where a release used to throw or coast without end

<!-- entry: fix -->
