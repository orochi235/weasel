---
'@weasel-js/scale': patch
---

`spacedTicks` lays at most `MAX_TICKS` ticks, however small `minSpacing` is. A negative `inset` throws a `RangeError`, and a range wider than the largest double gets ticks rather than none.

<!-- entry: fix -->
