---
'@weasel-js/core': patch
---

Accept a named or cubic-bezier easing wherever a curve is taken, and let a
timeline's loop policy change after it is created.

`easing` was a bare function everywhere, which is fine to call and impossible to
name back, show in a picker, or serialize. It now also accepts the name of a
built-in (`'easeOutBack'`) or control points (`{ bezier: [0.4, 0, 0.2, 1] }`),
resolved by `resolveEasing` at the four places a curve is actually invoked. The
union is additive, so every existing function value stays assignable. Bezier x
control points are clamped to 0..1, which is what keeps the solve monotone.

`TimelineHandle.setLoop(loop)` sets policy and nothing else. A timeline already
parked at its duration does not restart — `rearm` declines to revive one — so
play it again by seeking to 0 and resuming. Restoring saved transport state
therefore cannot start playback as a side effect.
