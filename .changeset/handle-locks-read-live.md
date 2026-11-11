---
"@weasel-js/core": patch
---

A handle lock toggled during a handle drag or a balance-grip drag takes effect at once. The `editAnchors` dep's `handleLocks` is read live.

<!-- entry: fix -->
