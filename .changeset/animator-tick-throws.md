---
'@weasel-js/core': patch
---

An animation whose `onTick`, `onDone` or interpolator throws no longer stops the animator. The error is logged, that animation is removed, and every other animation keeps running — before, the rest of that frame's animations were skipped and no further frame was requested, while `isActive()` stayed true. `animator.watch` delivers a new `error` event carrying the thrown value, in place of `cancel`, or after `end` when `onDone` threw. A listener that switches exhaustively on `AnimatorEvent['type']` has one more case to handle.
