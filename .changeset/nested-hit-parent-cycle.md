---
'@weasel-js/core': patch
---

`createNestedHitTester` no longer hangs when the adapter's parents form a cycle; the ancestor climb stops at the first repeat.

<!-- entry: fix -->
