---
'@weasel-js/core': patch
---

`animator.pauseKey`, `resumeKey`, and `setTimeScaleByKey` did nothing to a `loop`, `tweenLoop`, or `stagger` holding that key, though its handle then reported itself paused. They now reach the composite's running children and a stagger's waiting items. A time scale or pause set on a loop also carries into each later iteration, where it used to last only for the one in flight.
