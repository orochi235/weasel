---
"@weasel-js/animator": patch
---

A timeline, root or nested, refuses a `NaN` `duration` with a `RangeError` where it is given, as a tween refuses a `NaN` `ms`. It played with its time at `NaN` and left the animator without calling `onDone`.
