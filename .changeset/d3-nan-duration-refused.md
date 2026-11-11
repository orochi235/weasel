---
"@weasel-js/d3": patch
---

A transition's `duration(NaN)` throws a `RangeError` where it is set. It used to throw from the animator when the tween started, out of `end()` or, behind a delay, out of a timer, and the transition never settled.
