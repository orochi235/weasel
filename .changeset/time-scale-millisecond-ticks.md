---
'@weasel-js/scale': minor
---

A time scale over less than a few seconds ticks on 1, 2 or 5 times a power of ten milliseconds and labels them to the millisecond, so a 300 ms span gets an axis rather than none.

`TimeUnit` gains `'millisecond'`, and `formatInstant(t, 'millisecond')` writes `12:00:00.250`.

<!-- entry: new api -->
