---
'@weasel-js/animator': patch
---

animator: a time scale below 0, or `NaN`, is refused where it is set, on `setTimeScale`, a handle's `setTimeScale`, and `setTimeScaleByKey`. It used to be accepted and then throw from the next frame (`RangeError: blits: sync went back`).
