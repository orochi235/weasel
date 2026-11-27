---
'@weasel-js/forge': patch
---

`fileEventsArrive` rejects with a `RangeError` when `waitMs` is NaN or below 0, rather than probing forever or answering false at once.

<!-- entry: fix -->
