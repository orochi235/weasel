---
'@weasel-js/history': patch
---

`createHistory` throws a `RangeError` for `historyLimit: NaN`, which had left the undo stack growing without a cap.

<!-- entry: fix -->
