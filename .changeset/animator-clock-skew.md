---
'@weasel-js/core': patch
---

Never let an animation's virtual clock run backwards.

`useAnimator` seeds each animation's `lastRealNow` from `now()` at register
time, then advances its virtual clock by the difference against the timestamp
the frame loop supplies. Those two share a time origin in a browser, where the
rAF timestamp and `performance.now()` are both page-relative — but that is a
browser guarantee, not a universal one, and jsdom starts them roughly 600ms
apart. The first frame's delta then came out hugely negative and `virtualNow`
spent dozens of frames climbing back toward zero before a tween advanced at
all: a 40ms glide took 95 frames and over a second of wall time, growing worse
the longer the process had been alive.

A frame's elapsed time is never negative, so the sample is now clamped at
zero. Under a shared origin this is a no-op.
