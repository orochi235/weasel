---
'@weasel-js/ui-input': patch
---

A sweep's `at` throws a `RangeError` when read at `NaN`, rather than answering `NaN` or `undefined`.

<!-- entry: fix -->
