---
'@weasel-js/history': patch
---

A step that fails partway rethrows its own error even when an op's `invert()` throws during the rollback. The rest of the step is still taken back, and the inverse that could not be built is logged.

<!-- entry: fix -->
