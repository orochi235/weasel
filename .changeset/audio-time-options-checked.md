---
'@weasel-js/audio': patch
---

`createAudioEngine`, `createScheduler`, and `createAudioGraph` throw a `RangeError` on a lookahead, tick interval, or fade that is not a finite number of ms (and an interval of 0), rather than going silent or spinning.

<!-- entry: fix -->
