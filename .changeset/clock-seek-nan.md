---
'@weasel-js/clock': patch
---

`clock.seek(NaN)`, or `seek(Infinity)` on a run that never ends, set `elapsed` to that value and left the clock unable to recover. Both now throw a `RangeError`, as a rate or duration that is no number does.
