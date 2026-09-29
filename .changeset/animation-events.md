---
"@weasel-js/core": patch
---

Add animator observability. `animator.watch(listener)` delivers a lifecycle event for every animation the animator runs — `start`, `end`, `cancel`, and `interrupt` when a new animation claims a `cancelKey` — plus a timeline's `lap`s and its event-track crossings at any nesting depth, each carrying the animation's id, kind, cancel-key and label. `animator.live()` returns a snapshot of what is running, with each animation's pause state, time scale, elapsed virtual time and, for tweens and timelines, progress. Every animation option set, timelines included, takes an optional `label`. With no listener attached nothing is built or delivered. Additive.
