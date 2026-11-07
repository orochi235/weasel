---
'@weasel-js/animator': patch
---

A target whose `show` threw stopped the animator's frame loop, freezing every animation it ran, on every target. The error is now logged and what moves that target is stopped, as a tick that throws retires its animation, and the rest play on.
