---
'@weasel-js/forge': patch
---

`watchRecovery` throws a `RangeError` for a `quietMs` that is not above 0, rather than checking every served file each millisecond.

<!-- entry: fix -->
