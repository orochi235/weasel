---
"@weasel-js/animator": patch
---

A frame gap past the double range, as from a frame at `-Number.MAX_VALUE` to one at `Number.MAX_VALUE`, counts as the largest double, and the animator's clock stops there, as an endless clock does. Such a frame threw from blits, and an animation started after it read its own clock as `NaN` and never ended.
