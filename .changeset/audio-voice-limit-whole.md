---
'@weasel-js/audio': patch
---

`createAudioEngine` and `createVoicePool` throw a `RangeError` on a voice limit that is not a whole number, such as `2.5` or `Infinity`.

A fractional limit had let one voice more than it sound before stealing.

<!-- entry: fix behavior -->
