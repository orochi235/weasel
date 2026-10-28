---
'@weasel-js/animator': patch
---

`useAnimator` takes an optional `clock`, a `ClockHandle` from `@weasel-js/clock`. Given one, the animator runs no frame loop of its own: it advances when the clock moves, reading its time from the clock, so the clock's pause, rate, seeking, `holdAt` and visibility gating govern it, and the host's `useClockLoop` syncs it. When the clock goes back, by a seek or a negative rate, the running animations play backward to the time it stands at; one that has ended meanwhile, at its end or back at its start, does not come back. Without a clock nothing changes. This adds API.
