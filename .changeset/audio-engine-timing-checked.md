---
'@weasel-js/audio': patch
---

`createAudioEngine` throws a `RangeError` on a `lookahead`, `tickInterval` or `insertFadeMs` it could not run with.

That is a lookahead or fade that is negative or not finite, or an interval not above 0 and at most 2^31 − 1 ms. `createScheduler`, `createInsertChain` and `createAudioGraph` refuse the same of their own options. A NaN lookahead fired nothing, an infinite interval ran passes back to back, and a NaN fade left an insert chain half wired.

<!-- entry: fix -->
