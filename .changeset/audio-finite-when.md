---
'@weasel-js/audio': patch
---

`play`, `playNote`, `playNoise` and `schedule` throw a `RangeError` on a `when` that is not finite, and
so does `stream` given one by an untyped caller, before it stops the element's earlier stream. A `NaN` or `Infinity` time never came due, so the booking sat in the scheduler's queue for
the engine's life, and a voice held its output chain and reported `isPlaying()` without ever sounding.
