---
'@weasel-js/audio': patch
---

`createAudioEngine`, `createScheduler`, and `createAudioGraph` throw a `RangeError` on a lookahead, interval, or fade that is not finite.

A negative one throws too, and so does a tick interval of 0.

<!-- entry: fix -->
