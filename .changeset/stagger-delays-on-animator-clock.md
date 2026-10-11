---
'@weasel-js/core': patch
---

`animator.stagger` now counts its delays on the animator's clock instead of wall-clock timers. A hidden tab or `animator.pause()` no longer lets the delays run out while nothing can tick, which started every remaining item on one frame afterward, and `animator.setTimeScale()` and the stagger's own `setTimeScale()` now stretch the delays along with the children. Waiting items start on a frame, after that frame's ticks. Breaking: `UseAnimatorOptions.setTimer` and `clearTimer` are removed, since nothing reads them; a test drives a stagger through `requestFrame` and `now` like any other animation.
