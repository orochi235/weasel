---
'@weasel-js/loupe': patch
---

`nearestStopIndex` throws a `RangeError` on an empty list of stops, rather than answering index 0 of a list that has none.

<!-- entry: fix -->
