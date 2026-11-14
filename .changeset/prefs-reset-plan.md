---
'@weasel-js/prefs': minor
'@weasel-js/labkit': minor
---

New `resetPlan` and `leafIsAtReset`: the writes a reset of a leaf or a group makes, read from what a surface shows.

`read(path)` returns a `LeafReading` (`{ value, mixed, each, auto }`, one entry of `each` per target), or `undefined` for a leaf the reset should not reach. A plan leaves out readouts and leaves already at their reset, and writes `AUTO` for a leaf that starts auto only where `auto` is defined. `prefNodeAt` finds the leaf, group, or section at a path. labkit's `auto` sentinel is now this same symbol.

<!-- entry: api new -->
