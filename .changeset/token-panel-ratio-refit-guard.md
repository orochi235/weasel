---
'@weasel-js/ui': patch
---

Switching a `TokenPanel` scale to `ratio` when its last step is zero or negative fits a ratio of 1 rather than `NaN` or 0.

<!-- entry: fix -->
