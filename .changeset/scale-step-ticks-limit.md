---
'@weasel-js/scale': minor
---

`stepTicks` throws a `RangeError` past a limit of ticks rather than hanging. The limit is `MAX_TICKS` (1,000,000) unless the new fourth argument raises it, and a scale's `ticks(count)` holds a huge `count` within it.

<!-- entry: fix api -->
