---
'@weasel-js/audio': patch
'@weasel-js/clock': patch
---

A clock whose `loop` is a fraction, such as 2.5, now counts its passes whole: it ends in pass 2, partway through, rather than reporting pass 1.5, and `shownInPass` places a time past such a run in its last pass.
`createClock` given a reopened position now throws on a NaN time or rate, and on a negative rate for a clock that is not seekable, as a seek or a rate write does.
An insert chain's `add` throws once its bus graph is disposed, where it used to accept an effect that was never routed and leave `settled()` waiting forever.
`createDelayEffect` throws on an opening `time` outside `0..maxTime`, as `setTime` does, instead of letting the node clamp it.
A pattern player whose `onStep` throws keeps booking steps; before, it went silent while `playing()` still said true.
